import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { DATABASE_URL } from "../constants";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Prisma 7 reads DATABASE_URL from env automatically
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = DATABASE_URL;
    }
    super();
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }
}
