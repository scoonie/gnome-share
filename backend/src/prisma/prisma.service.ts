import { Injectable, Logger } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import * as path from "path";
import { renameLegacyDb } from "../utils/rename-legacy-db";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    renameLegacyDb(path.join(process.cwd(), "data"));

    const rawUrl =
      process.env.DATABASE_URL || "file:./data/gnome-share.db";
    // libsql does not support query parameters in file: URLs, strip them
    const url = rawUrl.split("?")[0];
    const adapter = new PrismaLibSql({ url });
    super({ adapter });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }
}