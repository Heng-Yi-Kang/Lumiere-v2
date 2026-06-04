-- Add visible ingestion error state to notebook files.
ALTER TABLE "NotebookFile" ADD COLUMN "ingestionError" TEXT;

-- Durable async ingestion queue for uploaded videos.
CREATE TABLE "NotebookFileIngestionJob" (
    "id" TEXT NOT NULL,
    "notebookFileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookFileIngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotebookFileIngestionJob_notebookFileId_key" ON "NotebookFileIngestionJob"("notebookFileId");
CREATE INDEX "NotebookFileIngestionJob_status_availableAt_idx" ON "NotebookFileIngestionJob"("status", "availableAt");
CREATE INDEX "NotebookFileIngestionJob_status_lockedAt_idx" ON "NotebookFileIngestionJob"("status", "lockedAt");

ALTER TABLE "NotebookFileIngestionJob"
ADD CONSTRAINT "NotebookFileIngestionJob_notebookFileId_fkey"
FOREIGN KEY ("notebookFileId") REFERENCES "NotebookFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
