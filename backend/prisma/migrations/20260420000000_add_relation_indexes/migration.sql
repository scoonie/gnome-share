-- Add indexes on foreign-key columns that are queried on every
-- per-user / per-share lookup. SQLite does not auto-index FKs.
CREATE INDEX "OAuthUser_userId_idx" ON "OAuthUser"("userId");
CREATE INDEX "Share_creatorId_idx" ON "Share"("creatorId");
CREATE INDEX "Share_reverseShareId_idx" ON "Share"("reverseShareId");
CREATE INDEX "ShareRecipient_shareId_idx" ON "ShareRecipient"("shareId");
CREATE INDEX "File_shareId_idx" ON "File"("shareId");
