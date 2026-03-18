import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { DATABASE_URL } from "../constants";

// Extract the file path from the SQLite URL (strip "file:" prefix and query parameters)
function getSQLitePath(url: string): string {
  let path = url;
  if (path.startsWith("file:")) {
    path = path.slice(5);
  }
  const queryIndex = path.indexOf("?");
  if (queryIndex !== -1) {
    path = path.slice(0, queryIndex);
  }
  return path;
}

@Injectable()
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const dbPath = getSQLitePath(DATABASE_URL);
    const db = new Database(dbPath);
    const adapter = new PrismaBetterSQLite3(db);

    super({ adapter });
    super.$connect().then(() => this.logger.log("Connected to the database"));
  }
}
