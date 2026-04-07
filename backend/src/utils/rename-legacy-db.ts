import * as fs from "fs";
import * as path from "path";

/**
 * Rename the legacy pingvin-share.db to gnome-share.db if needed.
 *
 * @param dataDir - Absolute path to the directory that contains the database
 *                  files (e.g. `path.join(process.cwd(), 'data')`).
 */
export function renameLegacyDb(dataDir: string): void {
  if (process.env.DATABASE_URL) return;

  const newDb = path.join(dataDir, "gnome-share.db");
  const legacyDb = path.join(dataDir, "pingvin-share.db");

  if (fs.existsSync(newDb) || !fs.existsSync(legacyDb)) return;

  try {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      const src = legacyDb + suffix;
      const dst = newDb + suffix;
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    }
    console.log("[gnome-share] Renamed pingvin-share.db → gnome-share.db");
  } catch (err) {
    console.error(
      "[gnome-share] Failed to rename pingvin-share.db → gnome-share.db:",
      err,
    );
  }
}
