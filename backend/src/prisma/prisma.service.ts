import { Injectable, Logger } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    PrismaService.renameLegacyDb();

    const rawUrl =
      process.env.DATABASE_URL || "file:./data/gnome-share.db";
    // libsql does not support query parameters in file: URLs, strip them
    const url = rawUrl.split("?")[0];
    const adapter = new PrismaLibSql({ url });
    super({ adapter });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }

  /**
   * Rename the legacy pingvin-share.db to gnome-share.db if no custom
   * DATABASE_URL is set. This is a safety net in case the rename didn't
   * happen during prisma migrate (e.g. non-Docker usage without prisma.config).
   */
  private static renameLegacyDb(): void {
    if (process.env.DATABASE_URL) return;

    const newDb = path.resolve("./data/gnome-share.db");
    const legacyDb = path.resolve("./data/pingvin-share.db");

    if (!fs.existsSync(newDb) && fs.existsSync(legacyDb)) {
      try {
        for (const suffix of ["", "-wal", "-shm", "-journal"]) {
          const src = legacyDb + suffix;
          const dst = newDb + suffix;
          if (fs.existsSync(src)) {
            fs.renameSync(src, dst);
          }
        }
      } catch {
        // Rename failed (permissions, cross-device, etc.) – the app will
        // start with a fresh database; user can rename manually.
      }
    }
  }
}