import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getEmbeddingModel, generateEmbedding } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';
import {
  deleteNotebookChunkPointsByFile,
  deleteNotebookChunkPointsByIds,
  ensureNotebookChunksCollection,
  upsertNotebookChunkPoints,
} from '@/lib/qdrant';
import { splitIntoRagChunks } from '@/lib/rag/chunking';
import { buildChunkPayload } from '@/lib/rag/payload';
import type { RagIndexChunk } from '@/lib/rag/types';
import { assertVectorDimensions, getRagVectorDimensions } from '@/lib/rag/vector-dimensions';

export async function indexNotebookFileForRag(params: {
  extractedText?: string | null;
  fileId: string;
  fileName: string;
  fileType: string;
  chunks?: RagIndexChunk[];
  notebookId: string;
}) {
  const indexingStartedAt = performance.now();
  const chunks: RagIndexChunk[] = params.chunks?.length
    ? params.chunks
    : splitIntoRagChunks(params.extractedText || '');

  logBackendProcess('info', 'rag.index.started', {
    chunkCount: chunks.length,
    extractedTextChars: params.extractedText?.length || 0,
    fileId: params.fileId,
    fileName: params.fileName,
    fileType: params.fileType,
    notebookId: params.notebookId,
  });

  if (!chunks.length) {
    logBackendProcess('warn', 'rag.index.skipped', {
      elapsedMs: getElapsedMs(indexingStartedAt),
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
      reason: 'no_extractable_text',
    });
    return 0;
  }

  const embeddingModel = getEmbeddingModel();
  const vectorDimensions = getRagVectorDimensions();
  const collectionName = await ensureNotebookChunksCollection(vectorDimensions);
  const points = [];

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const chunkStartedAt = performance.now();
    const content = chunk.content;
    logBackendProcess('info', 'rag.embedding.started', {
      chunkIndex,
      chunkTextChars: content.length,
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
    });

    const embedding = await generateEmbedding(content);
    assertVectorDimensions(embedding, vectorDimensions);
    const payload = buildChunkPayload({
      chunk,
      chunkIndex,
      embeddingModel,
      fileId: params.fileId,
      fileName: params.fileName,
      fileType: params.fileType,
      notebookId: params.notebookId,
    });

    logBackendProcess('info', 'rag.embedding.completed', {
      chunkIndex,
      embeddingDims: embedding.length,
      elapsedMs: getElapsedMs(chunkStartedAt),
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
    });

    points.push({
      id: crypto.randomUUID(),
      metadata: {
        fileName: params.fileName,
        fileType: params.fileType,
        pageNumber: payload.pageNumber,
        slideNumber: payload.slideNumber,
        timestampEnd: payload.timestampEnd,
        timestampStart: payload.timestampStart,
        ...(chunk.metadata || {}),
      },
      payload,
      vector: embedding,
    });

    logBackendProcess('info', 'rag.chunk.prepared', {
      chunkIndex,
      elapsedMs: getElapsedMs(chunkStartedAt),
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
      tokenCount: payload.tokenCount,
    });
  }

  const pointIds = points.map((point) => point.id);
  try {
    await deleteNotebookChunkPointsByFile({
      collectionName,
      fileId: params.fileId,
      notebookId: params.notebookId,
    }).catch(() => undefined);
    await upsertNotebookChunkPoints({
      collectionName,
      points,
    });
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "NotebookFileChunk" WHERE "notebookFileId" = ${params.fileId}`,
      ...points.map((point) => prisma.$executeRaw`
        INSERT INTO "NotebookFileChunk" (
          "id",
          "notebookId",
          "notebookFileId",
          "qdrantPointId",
          "chunkIndex",
          "tokenCount",
          "metadata",
          "embeddingModel",
          "updatedAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${params.notebookId},
          ${params.fileId},
          ${point.id},
          ${point.payload.chunkIndex},
          ${point.payload.tokenCount},
          ${JSON.stringify(point.metadata)}::jsonb,
          ${embeddingModel},
          NOW()
        )
      `),
    ]);
  } catch (error) {
    await deleteNotebookChunkPointsByIds({
      collectionName,
      pointIds,
    }).catch((cleanupError) => {
      logBackendProcess('error', 'rag.index.cleanup_failed', {
        cleanupError: cleanupError instanceof Error ? cleanupError.message : 'Unknown Qdrant cleanup error',
        fileId: params.fileId,
        notebookId: params.notebookId,
      });
    });
    throw error;
  }

  logBackendProcess('info', 'rag.index.completed', {
    chunkCount: chunks.length,
    elapsedMs: getElapsedMs(indexingStartedAt),
    embeddingModel,
    vectorDimensions,
    fileId: params.fileId,
    fileName: params.fileName,
    notebookId: params.notebookId,
  });

  return chunks.length;
}
