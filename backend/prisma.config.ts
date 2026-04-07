import { defineConfig } from 'prisma/config';
import * as path from 'path';
import { renameLegacyDb } from './src/utils/rename-legacy-db';

/**
 * Auto-rename legacy Pingvin Share database on upgrade.
 * This must happen before Prisma migrate/seed to avoid creating a second,
 * empty database file.
 */
renameLegacyDb(path.join(process.cwd(), 'data'));

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/config.seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/gnome-share.db?connection_limit=1',
  },
});
