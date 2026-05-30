CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "NotebookFileChunk" (
  "id" TEXT NOT NULL,
  "notebookId" TEXT NOT NULL,
  "notebookFileId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "embedding" vector(4096) NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embeddingDims" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotebookFileChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotebookFileChunk_notebookFileId_chunkIndex_key"
  ON "NotebookFileChunk"("notebookFileId", "chunkIndex");

CREATE INDEX "NotebookFileChunk_notebookId_idx"
  ON "NotebookFileChunk"("notebookId");

CREATE INDEX "NotebookFileChunk_notebookFileId_idx"
  ON "NotebookFileChunk"("notebookFileId");

CREATE INDEX "NotebookFileChunk_embedding_hnsw_idx"
  ON "NotebookFileChunk"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "NotebookFileChunk"
  ADD CONSTRAINT "NotebookFileChunk_notebookFileId_fkey"
  FOREIGN KEY ("notebookFileId") REFERENCES "NotebookFile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
