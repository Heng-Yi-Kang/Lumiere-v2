CREATE TYPE "HlsStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

ALTER TABLE "NotebookFile"
  ADD COLUMN "hlsStatus" "HlsStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "hlsMasterPlaylistUrl" TEXT,
  ADD COLUMN "hlsGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "videoDurationSeconds" DOUBLE PRECISION,
  ADD COLUMN "videoResolution" TEXT;

