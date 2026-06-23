-- CreateTable
CREATE TABLE "ReverseShareViewer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "reverseShareId" TEXT NOT NULL,
    CONSTRAINT "ReverseShareViewer_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReverseShareViewer_reverseShareId_idx" ON "ReverseShareViewer"("reverseShareId");

-- CreateIndex
CREATE INDEX "ReverseShareViewer_email_idx" ON "ReverseShareViewer"("email");
