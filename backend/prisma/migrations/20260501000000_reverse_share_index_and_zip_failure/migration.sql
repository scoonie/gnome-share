-- Add an index on ReverseShare.creatorId. Sibling foreign-key columns
-- (Share.creatorId, Share.reverseShareId, ShareRecipient.shareId, ...)
-- already have explicit indexes; ReverseShare.creatorId was the only FK
-- being queried per-user without one. SQLite does not auto-index FKs.
CREATE INDEX "ReverseShare_creatorId_idx" ON "ReverseShare"("creatorId");

-- Persist zip-creation failure so the UI can surface the failure to the user
-- instead of just logging it server-side.
ALTER TABLE "Share" ADD COLUMN "zipCreationFailed" BOOLEAN NOT NULL DEFAULT false;
