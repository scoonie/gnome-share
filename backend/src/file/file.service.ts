import { Injectable } from "@nestjs/common";
import { LocalFileService } from "./local.service";
import { Readable } from "stream";

@Injectable()
export class FileService {
  constructor(
    private localFileService: LocalFileService,
  ) {}

  async create(
    data: string,
    chunk: { index: number; total: number },
    file: {
      id?: string;
      name: string;
    },
    shareId: string,
  ) {
    return this.localFileService.create(data, chunk, file, shareId);
  }

  async get(shareId: string, fileId: string): Promise<File> {
    return this.localFileService.get(shareId, fileId);
  }

  async remove(shareId: string, fileId: string) {
    return this.localFileService.remove(shareId, fileId);
  }

  async deleteAllFiles(shareId: string) {
    return this.localFileService.deleteAllFiles(shareId);
  }

  async getZip(shareId: string): Promise<Readable> {
    return await this.localFileService.getZip(shareId);
  }

}

export interface File {
  metaData: {
    id: string;
    size: string;
    createdAt: Date;
    mimeType: string | false;
    name: string;
    shareId: string;
  };
  file: Readable;
}
