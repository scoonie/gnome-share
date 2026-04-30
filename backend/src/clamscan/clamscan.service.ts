import { Injectable, Logger } from "@nestjs/common";
import NodeClam from "clamscan";
import * as fs from "fs";
import * as path from "path";
import { FileService } from "src/file/file.service";
import { PrismaService } from "src/prisma/prisma.service";
import { CLAMAV_HOST, CLAMAV_PORT, SHARE_DIRECTORY } from "../constants";

const clamscanConfig = {
  clamdscan: {
    host: CLAMAV_HOST,
    port: CLAMAV_PORT,
    localFallback: false,
  },
  preference: "clamdscan",
};

@Injectable()
export class ClamScanService {
  private readonly logger = new Logger(ClamScanService.name);

  constructor(
    private fileService: FileService,
    private prisma: PrismaService,
  ) {}

  // ==========================================
  // --- CHANGED: Lazy-load Scanner Methods ---
  // ==========================================
  private clamScanner: NodeClam | null = null;

  private async getScanner(): Promise<NodeClam | null> {
    if (this.clamScanner) return this.clamScanner; // Return cached instance if already connected

    try {
      this.clamScanner = await new NodeClam().init(clamscanConfig);
      this.logger.log("ClamAV connection established successfully");
      return this.clamScanner;
    } catch (error) {
      this.logger.warn("ClamAV is not active or not ready yet.");
      return null; // Will try again next time a file is scanned
    }
  }
  // ==========================================

  async check(shareId: string) {
    // CHANGED: Use the new getter function here instead of this.ClamScan
    const clamScan = await this.getScanner();

    if (!clamScan) {
      this.logger.warn(
        `ClamAV scanner not available, skipping scan for share ${shareId}`,
      );
      return [];
    }

    try {
      const infectedFiles = [];

      const safeShareId = path.basename(shareId);
      const rootDir = path.resolve(SHARE_DIRECTORY);
      const shareDir = path.resolve(rootDir, safeShareId);
      if (!shareDir.startsWith(rootDir + path.sep)) {
        this.logger.warn(
          `Invalid share path for share ${shareId}, skipping scan`,
        );
        return [];
      }

      const files = fs
        .readdirSync(shareDir)
        .filter((file) => file != "archive.zip");

      this.logger.log(
        `Starting ClamAV scan for share ${shareId} (${files.length} file(s))`,
      );

      for (const fileId of files) {
        const safeFileId = path.basename(fileId);
        const filePath = path.resolve(shareDir, safeFileId);
        if (!filePath.startsWith(shareDir + path.sep)) {
          continue;
        }

        const scanResult = await clamScan
          .isInfected(filePath)
          .catch((err) => {
            this.logger.warn(
              `ClamAV scan error for file ${fileId} in share ${shareId}: ${err instanceof Error ? err.message : err}`,
            );
            // The cached clamd connection may now be stale (for example if
            // the ClamAV daemon was restarted). Drop it so the next scan
            // re-initialises a fresh connection instead of silently
            // returning "not infected" forever.
            this.clamScanner = null;
            return null;
          });

        if (scanResult === null) {
          // Connection was reset; abort this scan and let the next call
          // re-establish the scanner.
          return [];
        }

        const fileRecord = await this.prisma.file.findUnique({
          where: { id: fileId },
        });
        const fileName = fileRecord?.name ?? fileId;

        if (scanResult.isInfected) {
          infectedFiles.push({ id: fileId, name: fileName });
          this.logger.warn(
            `Malicious file detected: ${fileName} (${fileId}) in share ${shareId}`,
          );
        }
      }

      this.logger.log(
        `ClamAV scan complete for share ${shareId}: ${infectedFiles.length} infected file(s) out of ${files.length}`,
      );

      return infectedFiles;
    } catch (err) {
      // Reset the cached scanner on unexpected errors too so a stale
      // connection (e.g. after a ClamAV restart) doesn't keep failing.
      this.clamScanner = null;
      this.logger.error(
        `Unexpected error during ClamAV scan for share ${shareId}: ${err instanceof Error ? err.message : err}`,
        err instanceof Error ? err.stack : undefined,
      );
      return [];
    }
  }

  async checkAndRemove(shareId: string) {
    this.logger.log(`Running ClamAV check and remove for share ${shareId}`);
    const infectedFiles = await this.check(shareId);

    if (infectedFiles.length > 0) {
      await this.fileService.deleteAllFiles(shareId);
      await this.prisma.file.deleteMany({ where: { shareId } });

      const fileNames = infectedFiles.map((file) => file.name).join(", ");

      await this.prisma.share.update({
        where: { id: shareId },
        data: {
          removedReason: `Your share got removed because the file(s) ${fileNames} are malicious.`,
        },
      });

      this.logger.warn(
        `Share ${shareId} deleted because it contained ${infectedFiles.length} malicious file(s)`,
      );
    }
  }
}
