ALTER TABLE "NotebookFile"
  ADD COLUMN "summaryStatus" TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN "summaryError" TEXT,
  ADD COLUMN "summaryGeneratedAt" TIMESTAMP(3);
