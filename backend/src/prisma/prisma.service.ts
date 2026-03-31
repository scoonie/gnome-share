import { Injectable, Logger } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const rawUrl =
      process.env.DATABASE_URL || "file:./data/gnome-share.db";
    // libsql does not support query parameters in file: URLs, strip them
    const url = rawUrl.split("?")[0];
    const adapter = new PrismaLibSql({ url });
    super({ adapter });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }
}
