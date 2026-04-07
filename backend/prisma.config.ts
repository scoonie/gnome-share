import { defineConfig } from 'prisma/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Auto-rename legacy Pingvin Share database on upgrade.
 * This must happen before Prisma migrate/seed to avoid creating a second,
 * empty database file.
 */
if (!process.env.DATABASE_URL) {
  const dataDir = path.join(__dirname, 'data');
  const newDb = path.join(dataDir, 'gnome-share.db');
  const legacyDb = path.join(dataDir, 'pingvin-share.db');

  if (!fs.existsSync(newDb) && fs.existsSync(legacyDb)) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const src = legacyDb + suffix;
      const dst = newDb + suffix;
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    }
    console.log('[prisma.config] Renamed pingvin-share.db → gnome-share.db');
  }
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/config.seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/gnome-share.db?connection_limit=1',
  },
});
