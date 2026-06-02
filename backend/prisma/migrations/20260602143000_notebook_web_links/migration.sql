ALTER TABLE "NotebookFile"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "siteName" TEXT;

CREATE UNIQUE INDEX "NotebookFile_notebookId_sourceUrl_key"
  ON "NotebookFile"("notebookId", "sourceUrl");
