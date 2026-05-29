ALTER TABLE "NotebookFile"
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "previewContent" TEXT,
ADD COLUMN "previewFormat" TEXT,
ADD COLUMN "sourcePath" TEXT;

ALTER TABLE "NotebookFile"
DROP COLUMN "transcript";
