import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/config.seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/pingvin-share.db?connection_limit=1',
  },
});
