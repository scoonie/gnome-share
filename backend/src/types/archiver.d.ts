declare module "archiver" {
  import { Readable, Transform } from "node:stream";

  export interface ZipArchiveOptions {
    zlib?: {
      level?: number;
    };
  }

  export interface ZipEntryData {
    name: string;
  }

  export class ZipArchive extends Transform {
    constructor(options?: ZipArchiveOptions);
    append(source: Readable | Buffer | string, data: ZipEntryData): this;
    finalize(): Promise<void>;
    abort(): this;
  }
}
