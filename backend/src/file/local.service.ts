import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "crypto";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as mime from "mime-types";
import * as path from "path";
import { ConfigService } from "src/config/config.service";
import { PrismaService } from "src/prisma/prisma.service";
import { validate as isValidUUID } from "uuid";
import { SHARE_DIRECTORY } from "../constants";
import { Readable } from "stream";

@Injectable()
export class LocalFileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: { id?: string; name?: unknown },
    shareId: string,
  ) {
    const safeShareId = path.basename(shareId);
    if (!file.id) {
      file.id = crypto.randomUUID();
    } else if (!isValidUUID(file.id)) {
      throw new BadRequestException("Invalid file ID format");
    }

    const safeFileId = file.id as string;
    if (safeFileId.includes("/") || safeFileId.includes("\\")) {
      // Defensive check to ensure the file ID cannot be used for path traversal
      throw new BadRequestException("Invalid file ID format");
    }

    // Resolve and validate the share directory and file paths to keep them under SHARE_DIRECTORY
    const shareRoot = path.resolve(SHARE_DIRECTORY, safeShareId);
    const tempChunkPath = path.resolve(shareRoot, `${safeFileId}.tmp-chunk`);
    const finalFilePath = path.resolve(shareRoot, safeFileId);
    const resolvedShareRoot = path.resolve(SHARE_DIRECTORY);
    if (
      !tempChunkPath.startsWith(resolvedShareRoot + path.sep) ||
      !finalFilePath.startsWith(resolvedShareRoot + path.sep)
    ) {
      throw new BadRequestException("Invalid file path");
    }

    // Prevent overwriting already-completed files
    const existingFile = await this.prisma.file.findUnique({
      where: { id: file.id },
    });
    if (existingFile) {
      throw new BadRequestException("File ID already exists");
    }

    // Sanitize file name to prevent path traversal (Zip Slip)
    if (!file.name || typeof file.name !== "string") {
      throw new BadRequestException("File name is required and must be a string");
    }
    file.name = path.basename(file.name.replace(/\\/g, "/"));
    if (!file.name || file.name === "." || file.name === "..") {
      throw new BadRequestException("Invalid file name");
    }

    const share = await this.prisma.share.findUnique({
      where: { id: safeShareId },
      include: { files: true, reverseShare: true },
    });

    if (share.uploadLocked)
      throw new BadRequestException("Share is already completed");

    let diskFileSize: number;
    try {
      diskFileSize = (await fs.stat(tempChunkPath)).size;
    } catch {
      diskFileSize = 0;
    }

    // If the sent chunk index and the expected chunk index doesn't match throw an error
    const chunkSize = this.config.get("share.chunkSize");
    const expectedChunkIndex = Math.ceil(diskFileSize / chunkSize);

    if (expectedChunkIndex != chunk.index)
      throw new BadRequestException({
        message: "Unexpected chunk received",
        error: "unexpected_chunk_index",
        expectedChunkIndex,
      });

    const buffer = Buffer.from(data, "base64");

    // Check if there is enough space on the server
    const space = await fs.statfs(SHARE_DIRECTORY);
    const availableSpace = space.bavail * space.bsize;
    if (availableSpace < buffer.byteLength) {
      throw new InternalServerErrorException("Not enough space on the server");
    }

    // Check if share size limit is exceeded
    const fileSizeSum = share.files.reduce(
      (n, { size }) => n + parseInt(size),
      0,
    );

    // Also account for in-progress uploads (.tmp-chunk files)
    let inProgressSize = 0;
    try {
      const dirEntries = await fs.readdir(`${SHARE_DIRECTORY}/${safeShareId}`);
      for (const entry of dirEntries) {
        if (entry.endsWith(".tmp-chunk") && entry !== `${file.id}.tmp-chunk`) {
          try {
            const stat = await fs.stat(
              `${SHARE_DIRECTORY}/${safeShareId}/${entry}`,
            );
            inProgressSize += stat.size;
          } catch {
            // File may have been removed between readdir and stat
          }
        }
      }
    } catch {
      // Directory may not exist yet
    }

    const shareSizeSum = fileSizeSum + inProgressSize + diskFileSize + buffer.byteLength;

    if (
      shareSizeSum > this.config.get("share.maxSize") ||
      (share.reverseShare?.maxShareSize &&
        shareSizeSum > parseInt(share.reverseShare.maxShareSize))
    ) {
      throw new HttpException(
        "Max share size exceeded",
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    await fs.appendFile(
      tempChunkPath,
      buffer,
    );

    const isLastChunk = chunk.index == chunk.total - 1;
    if (isLastChunk) {
      await fs.rename(
        tempChunkPath,
        finalFilePath,
      );
      const fileSize = (
        await fs.stat(finalFilePath)
      ).size;
      await this.prisma.file.create({
        data: {
          id: safeFileId,
          name: file.name,
          size: fileSize.toString(),
          share: { connect: { id: safeShareId } },
        },
      });
    }

    return file;
  }

  async get(shareId: string, fileId: string) {
    const safeShareId = path.basename(shareId);
    if (!isValidUUID(fileId)) {
      throw new BadRequestException("Invalid file id");
    }
    const safeFileId = fileId;
    const fileMetaData = await this.prisma.file.findFirst({
      where: { id: safeFileId, shareId: safeShareId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    const file = createReadStream(
      `${SHARE_DIRECTORY}/${safeShareId}/${safeFileId}`,
    );

    return {
      metaData: {
        mimeType: mime.contentType(fileMetaData.name.split(".").pop()),
        ...fileMetaData,
        size: fileMetaData.size,
      },
      file,
    };
  }

  async remove(shareId: string, fileId: string) {
    const safeShareId = path.basename(shareId);
    if (!isValidUUID(fileId)) {
      throw new BadRequestException("Invalid file id");
    }
    const safeFileId = fileId;
    const fileMetaData = await this.prisma.file.findFirst({
      where: { id: safeFileId, shareId: safeShareId },
    });

    if (!fileMetaData) throw new NotFoundException("File not found");

    await fs.unlink(`${SHARE_DIRECTORY}/${safeShareId}/${safeFileId}`);

    await this.prisma.file.delete({ where: { id: safeFileId } });
  }

  async deleteAllFiles(shareId: string) {
    const safeShareId = path.basename(shareId);
    await fs.rm(path.join(SHARE_DIRECTORY, safeShareId), {
      recursive: true,
      force: true,
    });
  }

  async getZip(shareId: string): Promise<Readable> {
    const safeShareId = path.basename(shareId);
    return new Promise((resolve, reject) => {
      const zipStream = createReadStream(
        `${SHARE_DIRECTORY}/${safeShareId}/archive.zip`,
      );

      zipStream.on("error", (err) => {
        reject(new InternalServerErrorException(err));
      });

      zipStream.on("open", () => {
        resolve(zipStream);
      });
    });
  }
}
