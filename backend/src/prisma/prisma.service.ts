import { Injectable, Logger } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import * as fs from "fs";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const rawUrl =
      process.env.DATABASE_URL || PrismaService.resolveDefaultDbUrl();
    // libsql does not support query parameters in file: URLs, strip them
    const url = rawUrl.split("?")[0];
    const adapter = new PrismaLibSql({ url });
    super({ adapter });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }

  /**
   * If no DATABASE_URL is set, prefer gnome-share.db but fall back to the
   * legacy pingvin-share.db when upgrading from an older installation.
   */
  private static resolveDefaultDbUrl(): string {
    const newDb = "./data/gnome-share.db";
    const legacyDb = "./data/pingvin-share.db";

    if (!fs.existsSync(newDb) && fs.existsSync(legacyDb)) {
      return `file:${legacyDb}`;
    }
    return `file:${newDb}`;
  }
}