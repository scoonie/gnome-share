-- Change File.size from TEXT to INTEGER
-- SQLite does not support ALTER COLUMN, so we rebuild the table.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_File" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "shareId" TEXT NOT NULL,
    CONSTRAINT "File_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_File" ("id", "createdAt", "name", "size", "shareId")
    SELECT "id", "createdAt", "name", CAST("size" AS INTEGER), "shareId" FROM "File";

DROP TABLE "File";
ALTER TABLE "new_File" RENAME TO "File";
CREATE INDEX "File_shareId_idx" ON "File"("shareId");

-- Change ReverseShare.maxShareSize from TEXT to INTEGER
CREATE TABLE "new_ReverseShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shareExpiration" DATETIME NOT NULL,
    "maxShareSize" INTEGER NOT NULL DEFAULT 0,
    "sendEmailNotification" BOOLEAN NOT NULL,
    "remainingUses" INTEGER NOT NULL,
    "simplified" BOOLEAN NOT NULL DEFAULT false,
    "publicAccess" BOOLEAN NOT NULL DEFAULT true,
    "creatorId" TEXT NOT NULL,
    CONSTRAINT "ReverseShare_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ReverseShare" ("id", "createdAt", "token", "name", "description", "shareExpiration", "maxShareSize", "sendEmailNotification", "remainingUses", "simplified", "publicAccess", "creatorId")
    SELECT "id", "createdAt", "token", "name", "description", "shareExpiration", CAST("maxShareSize" AS INTEGER), "sendEmailNotification", "remainingUses", "simplified", "publicAccess", "creatorId" FROM "ReverseShare";

DROP TABLE "ReverseShare";
ALTER TABLE "new_ReverseShare" RENAME TO "ReverseShare";
CREATE UNIQUE INDEX "ReverseShare_token_key" ON "ReverseShare"("token");

PRAGMA foreign_keys=ON;
