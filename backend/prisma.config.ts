import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/config.seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/gnome-share.db?connection_limit=1',
  },
});
