import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import dayjs, { ManipulateType } from "dayjs";
import { ConfigService } from "src/config/config.service";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { parseRelativeDateToAbsolute } from "src/utils/date.util";
import { CreateReverseShareDTO } from "./dto/createReverseShare.dto";
import { UpdateReverseShareDTO } from "./dto/updateReverseShare.dto";

@Injectable()
export class ReverseShareService {
  private readonly logger = new Logger(ReverseShareService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  private normalizeViewerEmails(
    viewerEmails: string[] | undefined,
    creatorEmail?: string,
  ): string[] {
    if (!viewerEmails) return [];

    const normalizedCreatorEmail = creatorEmail?.trim().toLowerCase();

    const normalized = viewerEmails
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)
      .filter((email) => email !== normalizedCreatorEmail);

    return Array.from(new Set(normalized));
  }

  async create(data: CreateReverseShareDTO, creatorId: string) {
    if (data.shareExpiration === "never") {
      throw new BadRequestException("Permanent shares are not supported");
    }
    const expirationDate = parseRelativeDateToAbsolute(data.shareExpiration);

    const maxExpiration = this.config.get("share.maxExpiration");
    if (
      maxExpiration.value !== 0 &&
      expirationDate >
        dayjs()
          .add(maxExpiration.value, maxExpiration.unit as ManipulateType)
          .toDate()
    ) {
      throw new BadRequestException(
        "Expiration date exceeds maximum expiration date",
      );
    }

    const globalMaxShareSize = this.config.get("share.maxSize");

    if (globalMaxShareSize < data.maxShareSize)
      throw new BadRequestException(
        `Max share size can't be greater than ${globalMaxShareSize} bytes.`,
      );

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });

    const viewerEmails = this.normalizeViewerEmails(
      data.viewerEmails,
      creator?.email,
    );

    const reverseShare = await this.prisma.reverseShare.create({
      data: {
        name: data.name,
        description: data.description,
        shareExpiration: expirationDate,
        remainingUses: data.maxUseCount,
        maxShareSize: data.maxShareSize,
        sendEmailNotification: data.sendEmailNotification,
        simplified: data.simplified,
        publicAccess: data.publicAccess,
        creatorId,
        viewers: {
          create: viewerEmails.map((email) => ({ email })),
        },
      },
    });

    return reverseShare.token;
  }

  async update(id: string, data: UpdateReverseShareDTO) {
    const reverseShare = await this.prisma.reverseShare.findUnique({
      where: { id },
      include: { creator: true },
    });

    if (!reverseShare) {
      throw new BadRequestException("Reverse share not found");
    }

    const viewerEmails = this.normalizeViewerEmails(
      data.viewerEmails,
      reverseShare.creator.email,
    );

    await this.prisma.$transaction([
      this.prisma.reverseShareViewer.deleteMany({
        where: { reverseShareId: id },
      }),
      this.prisma.reverseShareViewer.createMany({
        data: viewerEmails.map((email) => ({ email, reverseShareId: id })),
      }),
    ]);
  }

  async getByToken(reverseShareToken?: string) {
    if (!reverseShareToken) return null;

    const reverseShare = await this.prisma.reverseShare.findUnique({
      where: { token: reverseShareToken },
    });

    return reverseShare;
  }

  async getAllByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const userEmail = user?.email.trim().toLowerCase();

    const reverseShares = await this.prisma.reverseShare.findMany({
      where: {
        shareExpiration: { gt: new Date() },
        OR: [
          { creatorId: userId },
          ...(userEmail
            ? [{ viewers: { some: { email: userEmail } } }]
            : []),
        ],
      },
      orderBy: {
        shareExpiration: "desc",
      },
      include: {
        shares: { include: { creator: true, files: true } },
        viewers: true,
      },
    });

    return reverseShares.map((reverseShare) => {
      const isOwner = reverseShare.creatorId === userId;
      return {
        ...reverseShare,
        isOwner,
        viewerEmails: isOwner
          ? reverseShare.viewers.map((viewer) => viewer.email)
          : [],
      };
    });
  }

  async isValid(reverseShareToken: string) {
    const reverseShare = await this.prisma.reverseShare.findUnique({
      where: { token: reverseShareToken },
    });

    if (!reverseShare) return false;

    const isExpired = new Date() > reverseShare.shareExpiration;
    const remainingUsesExceeded = reverseShare.remainingUses <= 0;

    return !(isExpired || remainingUsesExceeded);
  }

  async remove(id: string) {
    const shares = await this.prisma.share.findMany({
      where: { reverseShare: { id } },
    });

    const cleanedShareIds: string[] = [];

    for (const share of shares) {
      try {
        await this.fileService.deleteAllFiles(share.id);
        cleanedShareIds.push(share.id);
      } catch (e) {
        this.logger.error(
          `Failed to delete files for reverse share ${id}, share ${share.id}: ${e}`,
        );
      }
    }

    if (cleanedShareIds.length > 0) {
      await this.prisma.share.deleteMany({
        where: { id: { in: cleanedShareIds } },
      });
    }

    await this.prisma.reverseShare.delete({ where: { id } });
  }
}
