import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    schema: './prisma/schema.prisma',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/pingvin-share.db?connection_limit=1',
  },
});
