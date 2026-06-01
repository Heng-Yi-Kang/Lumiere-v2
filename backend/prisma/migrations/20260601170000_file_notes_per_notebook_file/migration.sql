DROP TABLE IF EXISTS "Note";

CREATE TABLE "FileNote" (
  "id" TEXT NOT NULL,
  "notebookFileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FileNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileNote_notebookFileId_idx" ON "FileNote"("notebookFileId");

ALTER TABLE "FileNote"
ADD CONSTRAINT "FileNote_notebookFileId_fkey"
FOREIGN KEY ("notebookFileId") REFERENCES "NotebookFile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
