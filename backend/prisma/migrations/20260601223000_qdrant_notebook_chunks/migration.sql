DELETE FROM "NotebookFileChunk";

DROP INDEX IF EXISTS "NotebookFileChunk_embedding_subvector_hnsw_idx";

ALTER TABLE "NotebookFileChunk"
  DROP COLUMN "content",
  DROP COLUMN "embedding",
  DROP COLUMN "embeddingDims",
  ADD COLUMN "qdrantPointId" TEXT NOT NULL;

CREATE UNIQUE INDEX "NotebookFileChunk_qdrantPointId_key"
  ON "NotebookFileChunk"("qdrantPointId");
