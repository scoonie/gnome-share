import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "schema.prisma"),
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "file:../data/pingvin-share.db?connection_limit=1",
  },
});
