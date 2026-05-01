import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as fs from "fs";
import * as path from "path";
import dayjs from "dayjs";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { ReverseShareService } from "src/reverseShare/reverseShare.service";
import { SHARE_DIRECTORY } from "../constants";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private reverseShareService: ReverseShareService,
    private fileService: FileService,
  ) {}

  @Cron("0 * * * *")
  async deleteExpiredShares() {
    const expiredShares = await this.prisma.share.findMany({
      where: {
        expiration: { lt: new Date() },
      },
    });

    const cleanedShareIds: string[] = [];
    for (const expiredShare of expiredShares) {
      try {
        await this.fileService.deleteAllFiles(expiredShare.id);
        cleanedShareIds.push(expiredShare.id);
      } catch (e) {
        this.logger.error(
          `Failed to delete files for expired share ${expiredShare.id}: ${e}`,
        );
      }
    }
    await this.prisma.share.deleteMany({
      where: { id: { in: cleanedShareIds } },
    });

    if (cleanedShareIds.length > 0) {
      this.logger.log(`Deleted ${cleanedShareIds.length} expired shares`);
    }
  }

  @Cron("0 * * * *")
  async deleteExpiredReverseShares() {
    const expiredReverseShares = await this.prisma.reverseShare.findMany({
      where: {
        shareExpiration: { lt: new Date() },
      },
    });

    for (const expiredReverseShare of expiredReverseShares) {
      await this.reverseShareService.remove(expiredReverseShare.id);
    }

    if (expiredReverseShares.length > 0) {
      this.logger.log(
        `Deleted ${expiredReverseShares.length} expired reverse shares`,
      );
    }
  }

  @Cron("0 */6 * * *")
  async deleteUnfinishedShares() {
    const unfinishedShares = await this.prisma.share.findMany({
      where: {
        createdAt: { lt: dayjs().subtract(1, "day").toDate() },
        uploadLocked: false,
      },
    });

    const cleanedShareIds: string[] = [];
    for (const unfinishedShare of unfinishedShares) {
      try {
        await this.fileService.deleteAllFiles(unfinishedShare.id);
        cleanedShareIds.push(unfinishedShare.id);
      } catch (e) {
        this.logger.error(
          `Failed to delete files for unfinished share ${unfinishedShare.id}: ${e}`,
        );
      }
    }
    await this.prisma.share.deleteMany({
      where: { id: { in: cleanedShareIds } },
    });

    if (cleanedShareIds.length > 0) {
      this.logger.log(`Deleted ${cleanedShareIds.length} unfinished shares`);
    }
  }

  @Cron("0 0 * * *")
  async deleteTemporaryFiles() {
    let filesDeleted = 0;

    const rootDir = path.resolve(SHARE_DIRECTORY);
    let shareDirectories: string[];
    try {
      shareDirectories = (
        await fs.promises.readdir(SHARE_DIRECTORY, { withFileTypes: true })
      )
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
    } catch (e) {
      this.logger.error(`Failed to read share directory: ${e}`);
      return;
    }

    for (const shareDirectory of shareDirectories) {
      const safeDirName = path.basename(shareDirectory);
      const dirPath = path.resolve(rootDir, safeDirName);
      if (!dirPath.startsWith(rootDir + path.sep)) {
        continue;
      }

      let temporaryFiles: string[];
      try {
        temporaryFiles = (await fs.promises.readdir(dirPath)).filter((file) =>
          file.endsWith(".tmp-chunk"),
        );
      } catch (e) {
        this.logger.error(`Failed to read directory ${dirPath}: ${e}`);
        continue;
      }

      for (const file of temporaryFiles) {
        const safeFileName = path.basename(file);
        const filePath = path.resolve(dirPath, safeFileName);
        if (!filePath.startsWith(dirPath + path.sep)) {
          continue;
        }

        try {
          const stats = await fs.promises.stat(filePath);
          const isOlderThanOneDay = dayjs(stats.mtime)
            .add(1, "day")
            .isBefore(dayjs());

          if (isOlderThanOneDay) {
            await fs.promises.rm(filePath);
            filesDeleted++;
          }
        } catch (e) {
          this.logger.error(
            `Failed to process temporary file ${filePath}: ${e}`,
          );
        }
      }
    }

    this.logger.log(`Deleted ${filesDeleted} temporary files`);
  }

  @Cron("1 * * * *")
  async deleteExpiredTokens() {
    const { count: refreshTokenCount } =
      await this.prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

    const { count: loginTokenCount } = await this.prisma.loginToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const { count: resetPasswordTokenCount } =
      await this.prisma.resetPasswordToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

    const deletedTokensCount =
      refreshTokenCount + loginTokenCount + resetPasswordTokenCount;

    if (deletedTokensCount > 0) {
      this.logger.log(`Deleted ${deletedTokensCount} expired refresh tokens`);
    }
  }
}
