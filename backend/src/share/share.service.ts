import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import type { Share, User } from "../generated/prisma/client";
import archiver from "archiver";
import * as argon from "argon2";
import * as fs from "fs";
import * as path from "path";
import dayjs, { ManipulateType } from "dayjs";
import { ClamScanService } from "src/clamscan/clamscan.service";
import { ConfigService } from "src/config/config.service";
import { EmailService } from "src/email/email.service";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { parseRelativeDateToAbsolute } from "src/utils/date.util";
import { SHARE_DIRECTORY } from "../constants";
import { CreateShareDTO } from "./dto/createShare.dto";

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private fileService: FileService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private reverseShareService: ReverseShareService,
    private clamScanService: ClamScanService,
  ) {}

  async create(share: CreateShareDTO, user?: User, reverseShareToken?: string) {
    if (!(await this.isShareIdAvailable(share.id)).isAvailable)
      throw new BadRequestException("Share id already in use");

    if (!share.security || Object.keys(share.security).length == 0)
      share.security = undefined;

    if (share.security?.password) {
      share.security.password = await argon.hash(share.security.password);
    }

    let expirationDate: Date;

    // If share is created by a reverse share token override the expiration date
    const reverseShare =
      await this.reverseShareService.getByToken(reverseShareToken);
    if (reverseShare) {
      expirationDate = reverseShare.shareExpiration;
    } else {
      const parsedExpiration = parseRelativeDateToAbsolute(share.expiration);

      const expiresNever = dayjs(0).toDate() == parsedExpiration;

      const maxExpiration = this.config.get("share.maxExpiration");
      if (
        maxExpiration.value !== 0 &&
        (expiresNever ||
          parsedExpiration >
            dayjs().add(maxExpiration.value, maxExpiration.unit as ManipulateType).toDate())
      ) {
        throw new BadRequestException(
          "Expiration date exceeds maximum expiration date",
        );
      }

      expirationDate = parsedExpiration;
    }

    const safeShareId = path.basename(share.id);
    const rootDir = path.resolve(SHARE_DIRECTORY);
    const shareDirectoryPath = path.resolve(rootDir, safeShareId);
    if (!shareDirectoryPath.startsWith(rootDir + path.sep)) {
      throw new BadRequestException("Invalid share id");
    }
    fs.mkdirSync(shareDirectoryPath, {
      recursive: true,
    });

    const shareTuple = await this.prisma.share.create({
      data: {
        ...share,
        description: reverseShare ? reverseShare.description : share.description,
        expiration: expirationDate,
        creator: { connect: user ? { id: user.id } : undefined },
        security: { create: share.security },
        recipients: {
          create: share.recipients
            ? share.recipients.map((email) => ({ email }))
            : [],
        },
      },
    });

    if (reverseShare) {
      // Assign share to reverse share token
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: {
          shares: {
            connect: { id: shareTuple.id },
          },
        },
      });
    }

    return shareTuple;
  }

  async createZip(shareId: string) {
    const safeShareId = path.basename(shareId);
    const rootDir = path.resolve(SHARE_DIRECTORY);
    const sharePath = path.resolve(rootDir, safeShareId);
    if (!sharePath.startsWith(rootDir + path.sep)) {
      throw new BadRequestException("Invalid share path");
    }

    const files = await this.prisma.file.findMany({ where: { shareId } });
    const archive = archiver("zip", {
      zlib: { level: this.config.get("share.zipCompressionLevel") },
    });
    const archivePath = path.join(sharePath, "archive.zip");
    const tempArchivePath = path.join(
      sharePath,
      `archive.zip.${process.pid}.${Date.now()}.tmp`,
    );
    const writeStream = fs.createWriteStream(tempArchivePath);

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
          archive.removeListener("error", onError);
          writeStream.removeListener("error", onError);
          writeStream.removeListener("close", onClose);
          reject(err);
        };
        const onClose = () => {
          archive.removeListener("error", onError);
          writeStream.removeListener("error", onError);
          resolve();
        };

        archive.on("error", onError);
        writeStream.on("error", onError);
        writeStream.on("close", onClose);

        archive.pipe(writeStream);

        for (const file of files) {
          const safeFileId = path.basename(file.id);
          const filePath = path.resolve(sharePath, safeFileId);
          if (!filePath.startsWith(sharePath + path.sep)) {
            continue;
          }
          archive.append(fs.createReadStream(filePath), {
            name: file.name,
          });
        }

        archive.finalize().catch(onError);
      });

      try {
        await fs.promises.rename(tempArchivePath, archivePath);
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "EEXIST" && code !== "EPERM") {
          throw err;
        }
        const backupArchivePath = path.join(
          sharePath,
          `archive.zip.${process.pid}.${Date.now()}.bak`,
        );
        await fs.promises.rename(archivePath, backupArchivePath);
        try {
          await fs.promises.rename(tempArchivePath, archivePath);
        } catch (renameErr) {
          await fs.promises.rename(backupArchivePath, archivePath).catch(() => {
            return undefined;
          });
          throw renameErr;
        }
        await fs.promises.rm(backupArchivePath, { force: true });
      }
    } catch (err) {
      archive.abort();
      writeStream.destroy();
      await fs.promises.rm(tempArchivePath, { force: true }).catch(() => {
        return undefined;
      });
      throw err;
    }
  }

  async complete(id: string, reverseShareToken?: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: true,
        recipients: true,
        creator: true,
        reverseShare: { include: { creator: true } },
      },
    });

    if (await this.isShareCompleted(id))
      throw new BadRequestException("Share already completed");

    if (share.files.length == 0)
      throw new BadRequestException(
        "You need at least on file in your share to complete it.",
      );

    // Asynchronously create a zip of all files
    if (share.files.length > 1)
      this.createZip(id)
        .then(() => this.markZipReady(id))
        .catch(async (err) => {
          this.logger.error(
            `Failed to create zip for share ${id}: ${err instanceof Error ? err.message : err}`,
            err instanceof Error ? err.stack : undefined,
          );
          await this.prisma.share
            .update({ where: { id }, data: { zipCreationFailed: true } })
            .catch((updateErr) =>
              this.logger.error(
                `Failed to persist zipCreationFailed=true for share ${id}: ${updateErr instanceof Error ? updateErr.message : updateErr}`,
                updateErr instanceof Error ? updateErr.stack : undefined,
              ),
            );
        });

    // Send email for each recipient
    for (const recipient of share.recipients) {
      await this.emailService.sendMailToShareRecipients(
        recipient.email,
        share.id,
        share.creator,
        share.description,
        share.expiration,
      );
    }

    const notifyReverseShareCreator = share.reverseShare
      ? this.config.get("smtp.enabled") &&
        share.reverseShare.sendEmailNotification
      : undefined;

    if (notifyReverseShareCreator) {
      await this.emailService.sendMailToReverseShareCreator(
        share.reverseShare.creator.email,
        share.id,
      );
    }

    // Check if any file is malicious with ClamAV
    this.clamScanService.checkAndRemove(share.id).catch((err) => {
      this.logger.error(
        `ClamAV scan failed for share ${share.id}: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
    });

    if (share.reverseShare) {
      await this.prisma.reverseShare.update({
        where: { token: reverseShareToken },
        data: { remainingUses: { decrement: 1 } },
      });
    }

    const updatedShare = await this.prisma.share.update({
      where: { id },
      data: { uploadLocked: true },
    });

    return {
      ...updatedShare,
      notifyReverseShareCreator,
    };
  }

  async revertComplete(id: string) {
    return this.prisma.share.update({
      where: { id },
      data: { uploadLocked: false, isZipReady: false },
    });
  }

  async getShares(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [shares, total] = await Promise.all([
      this.prisma.share.findMany({
        skip,
        take: limit,
        orderBy: {
          expiration: "desc",
        },
        include: { files: true, creator: true },
      }),
      this.prisma.share.count(),
    ]);

    return {
      shares: shares.map((share) => {
        return {
          ...share,
          size: share.files.reduce((acc, file) => acc + file.size, 0),
        };
      }),
      total,
    };
  }

  async getSharesByUser(userId: string) {
    const shares = await this.prisma.share.findMany({
      where: {
        creator: { id: userId },
        uploadLocked: true,
        // We want to grab any shares that are not expired or have their expiration date set to "never" (unix 0)
        OR: [
          { expiration: { gt: new Date() } },
          { expiration: { equals: dayjs(0).toDate() } },
        ],
      },
      orderBy: {
        expiration: "desc",
      },
      include: { recipients: true, files: true, security: true },
    });

    return shares.map((share) => {
      return {
        ...share,
        size: share.files.reduce((acc, file) => acc + file.size, 0),
        recipients: share.recipients.map((recipients) => recipients.email),
        security: {
          maxViews: share.security?.maxViews,
          passwordProtected: !!share.security?.password,
        },
      };
    });
  }

  async get(id: string): Promise<any> {
    const share = await this.prisma.share.findUnique({
      where: { id },
      include: {
        files: {
          orderBy: {
            name: "asc",
          },
        },
        creator: true,
        security: true,
      },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    if (share.removedReason)
      throw new NotFoundException(share.removedReason, "share_removed");

    return {
      ...share,
      hasPassword: !!share.security?.password,
    };
  }

  async getMetaData(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
    });

    if (!share || !share.uploadLocked)
      throw new NotFoundException("Share not found");

    return share;
  }

  async remove(shareId: string, isDeleterAdmin = false) {
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) throw new NotFoundException("Share not found");

    if (!share.creatorId && !isDeleterAdmin)
      throw new ForbiddenException("Anonymous shares can't be deleted");

    await this.fileService.deleteAllFiles(shareId);
    await this.prisma.share.delete({ where: { id: shareId } });
  }

  async isShareCompleted(id: string) {
    const share = await this.prisma.share.findUnique({
      where: { id },
      select: { uploadLocked: true },
    });
    if (!share) throw new NotFoundException("Share not found");
    return share.uploadLocked;
  }

  async isShareIdAvailable(id: string) {
    const share = await this.prisma.share.findUnique({ where: { id } });
    return { isAvailable: !share };
  }

  /**
   * Atomically increment the share view counter, enforcing `maxViews` if set.
   * Throws NotFoundException if the share no longer exists, or
   * ForbiddenException when the `maxViews` limit has been reached.
   */
  async tryIncreaseViewCount(shareId: string, maxViews: number | null) {
    const where: { id: string; views?: { lt: number } } = { id: shareId };
    if (typeof maxViews === "number") {
      where.views = { lt: maxViews };
    }

    const result = await this.prisma.share.updateMany({
      where,
      data: { views: { increment: 1 } },
    });

    if (result.count === 0) {
      // updateMany().count === 0 can mean either the share has been deleted
      // or the `maxViews` predicate excluded it. Disambiguate so callers
      // get an accurate 404 vs. 403 instead of always seeing "max views
      // exceeded".
      const stillExists = await this.prisma.share.findUnique({
        where: { id: shareId },
        select: { id: true },
      });
      if (!stillExists) {
        throw new NotFoundException("Share not found");
      }
      throw new ForbiddenException(
        "Maximum views exceeded",
        "share_max_views_exceeded",
      );
    }
  }

  async increaseViewCount(share: Share) {
    await this.tryIncreaseViewCount(share.id, null);
  }

  async getShareToken(shareId: string, password: string) {
    const share = await this.prisma.share.findFirst({
      where: { id: shareId },
      include: {
        security: true,
      },
    });

    if (!share || !share.uploadLocked || share.removedReason) {
      throw new NotFoundException("Share not found");
    }

    if (share.security?.password) {
      if (!password) {
        throw new ForbiddenException(
          "This share is password protected",
          "share_password_required",
        );
      }

      const isPasswordValid = await argon.verify(
        share.security.password,
        password,
      );
      if (!isPasswordValid) {
        throw new ForbiddenException("Wrong password", "wrong_password");
      }
    }

    // Atomically check + increment views to prevent races where two concurrent
    // requests both pass `views < maxViews` before either persists the increment.
    await this.tryIncreaseViewCount(shareId, share.security?.maxViews ?? null);

    const token = await this.generateShareToken(shareId);
    return token;
  }

  async generateShareToken(shareId: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    const tokenPayload = {
      shareId,
      shareCreatedAt: dayjs(createdAt).unix(),
      iat: dayjs().unix(),
    };

    const tokenOptions: JwtSignOptions = {
      secret: this.config.get("internal.jwtSecret"),
    };

    if (dayjs(expiration).valueOf() !== 0) {
      tokenOptions.expiresIn = dayjs(expiration).diff(new Date(), "seconds");
    }

    return this.jwtService.sign(tokenPayload, tokenOptions);
  }

  /**
   * Retries the isZipReady=true DB update with bounded exponential backoff.
   * Up to 5 attempts; on final failure logs an error and gives up. createZip
   * only publishes archive.zip after the archive is complete, so readers never
   * observe a partially written archive.
   */
  private async markZipReady(id: string): Promise<void> {
    const delays = [200, 400, 800, 1600];
    const maxAttempts = delays.length + 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.prisma.share.update({
          where: { id },
          data: { isZipReady: true, zipCreationFailed: false },
        });
        return;
      } catch (e) {
        this.logger.warn(
          `Attempt ${attempt}/${maxAttempts} to mark share ${id} as zip-ready failed: ${e instanceof Error ? e.message : e}`,
        );
        if (attempt === maxAttempts) {
          this.logger.error(
            `All ${maxAttempts} attempts to mark share ${id} as zip-ready failed`,
            e instanceof Error ? e.stack : undefined,
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, delays[attempt - 1]));
      }
    }
  }

  async verifyShareToken(shareId: string, token: string) {
    const { expiration, createdAt } = await this.prisma.share.findUnique({
      where: { id: shareId },
    });

    try {
      const claims = this.jwtService.verify(token, {
        secret: this.config.get("internal.jwtSecret"),
        // Ignore expiration if expiration is 0
        ignoreExpiration: dayjs(expiration).valueOf() === 0,
      });

      return (
        claims.shareId == shareId &&
        claims.shareCreatedAt == dayjs(createdAt).unix()
      );
    } catch {
      return false;
    }
  }
}
