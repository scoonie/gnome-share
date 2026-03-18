import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }
}
