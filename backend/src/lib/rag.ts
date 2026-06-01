import { randomUUID } from 'node:crypto';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getEmbeddingModel, generateEmbedding } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';
import {
  deleteNotebookChunkPointsByFile,
  deleteNotebookChunkPointsByIds,
  deleteNotebookChunkPointsByNotebook,
  ensureNotebookChunksCollection,
  getQdrantCollectionName,
  type NotebookChunkPayload,
  searchNotebookChunks,
  upsertNotebookChunkPoints,
} from '@/lib/qdrant';

export const RAG_CHUNK_SIZE = 2000;
export const RAG_CHUNK_OVERLAP = 400;
export const RAG_PROMPT_SOURCE_CHAR_LIMIT = 1200;
export const RAG_VECTOR_DIMENSIONS = 4096;

type RagSearchOptions = {
  fileId?: string;
  limit?: number;
  notebookId: string;
  query: string;
};

export type RagSearchResult = {
  chunkIndex: number;
  content: string;
  fileId: string;
  fileName: string;
  score: number;
};

export type RagIndexChunk = {
  content: string;
  metadata?: Record<string, unknown>;
};

type RagChunkMetadata = {
  pageNumber?: unknown;
  slideNumber?: unknown;
  timestampEnd?: unknown;
  timestampStart?: unknown;
  videoTimestampEnd?: unknown;
  videoTimestampStart?: unknown;
};

function cleanText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

function takeOverlap(text: string, overlap: number) {
  if (text.length <= overlap) {
    return text;
  }

  const slice = text.slice(-overlap);
  const firstWhitespace = slice.search(/\s/);
  return firstWhitespace >= 0 ? slice.slice(firstWhitespace).trimStart() : slice;
}

export function splitIntoChunks(text: string, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP) {
  const source = cleanText(text);

  if (!source) {
    return [];
  }

  const paragraphs = source.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  function flush() {
    const value = current.trim();
    if (value) {
      chunks.push(value);
      current = takeOverlap(value, overlap);
    }
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize * 1.5) {
      flush();
      const sentences = paragraph.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [paragraph];
      for (const sentence of sentences.map((value) => value.trim()).filter(Boolean)) {
        if (`${current}\n${sentence}`.trim().length > chunkSize) {
          flush();
        }
        current = `${current}\n${sentence}`.trim();
      }
      continue;
    }

    if (`${current}\n\n${paragraph}`.trim().length > chunkSize) {
      flush();
    }
    current = `${current}\n\n${paragraph}`.trim();
  }

  flush();
  return chunks;
}

function assertVectorDimensions(vector: number[]) {
  if (vector.length !== RAG_VECTOR_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch. Expected ${RAG_VECTOR_DIMENSIONS}, received ${vector.length}.`);
  }
}

function nullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildChunkPayload(params: {
  chunk: RagIndexChunk;
  chunkIndex: number;
  embeddingModel: string;
  fileId: string;
  fileName: string;
  fileType: string;
  notebookId: string;
}) {
  const metadata = (params.chunk.metadata || {}) as RagChunkMetadata;
  const tokenCount = estimateTokenCount(params.chunk.content);

  return {
    notebookId: params.notebookId,
    notebookFileId: params.fileId,
    fileName: params.fileName,
    fileType: params.fileType,
    chunkIndex: params.chunkIndex,
    content: params.chunk.content,
    tokenCount,
    pageNumber: nullableNumber(metadata.pageNumber),
    slideNumber: nullableNumber(metadata.slideNumber),
    timestampStart: nullableNumber(metadata.timestampStart ?? metadata.videoTimestampStart),
    timestampEnd: nullableNumber(metadata.timestampEnd ?? metadata.videoTimestampEnd),
    embeddingModel: params.embeddingModel,
  } satisfies NotebookChunkPayload;
}

function isNotebookChunkPayload(value: unknown): value is NotebookChunkPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<NotebookChunkPayload>;
  return typeof payload.notebookId === 'string'
    && typeof payload.notebookFileId === 'string'
    && typeof payload.fileName === 'string'
    && typeof payload.fileType === 'string'
    && typeof payload.chunkIndex === 'number'
    && typeof payload.content === 'string'
    && typeof payload.tokenCount === 'number'
    && typeof payload.embeddingModel === 'string';
}

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
    : splitIntoChunks(params.extractedText || '').map((content) => ({ content }));

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
  const collectionName = await ensureNotebookChunksCollection(RAG_VECTOR_DIMENSIONS);
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
    assertVectorDimensions(embedding);
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
      id: randomUUID(),
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
          ${randomUUID()},
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
    fileId: params.fileId,
    fileName: params.fileName,
    notebookId: params.notebookId,
  });

  return chunks.length;
}

export async function retrieveNotebookRagContext(options: RagSearchOptions) {
  const searchStartedAt = performance.now();
  const limit = Math.min(Math.max(options.limit || 5, 1), 20);
  logBackendProcess('info', 'rag.search.started', {
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    queryChars: options.query.length,
  });

  const embeddingStartedAt = performance.now();
  logBackendProcess('info', 'rag.search.embedding.started', {
    notebookId: options.notebookId,
    queryChars: options.query.length,
  });

  const embedding = await generateEmbedding(options.query);
  assertVectorDimensions(embedding);
  logBackendProcess('info', 'rag.search.embedding.completed', {
    embeddingDims: embedding.length,
    elapsedMs: getElapsedMs(embeddingStartedAt),
    notebookId: options.notebookId,
  });

  const candidateLimit = Math.min(Math.max(limit * 4, 20), 100);
  const collectionName = await ensureNotebookChunksCollection(RAG_VECTOR_DIMENSIONS);

  logBackendProcess('info', 'rag.qdrant.search.started', {
    candidateLimit,
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
  });

  const hits = await searchNotebookChunks({
    collectionName,
    fileId: options.fileId,
    limit: candidateLimit,
    notebookId: options.notebookId,
    vector: embedding,
  });

  const payloads = hits
    .map((hit) => ({
      payload: hit.payload,
      score: hit.score,
    }))
    .filter((hit): hit is { payload: NotebookChunkPayload; score: number } => isNotebookChunkPayload(hit.payload));
  const fileIds = [...new Set(payloads.map((hit) => hit.payload.notebookFileId))];
  const validFiles = fileIds.length
    ? await prisma.notebookFile.findMany({
        where: {
          id: options.fileId || { in: fileIds },
          notebookId: options.notebookId,
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];
  const validFileNames = new Map(validFiles.map((file) => [file.id, file.name]));
  const results = payloads
    .filter((hit) => validFileNames.has(hit.payload.notebookFileId))
    .slice(0, limit)
    .map((hit) => ({
      chunkIndex: hit.payload.chunkIndex,
      content: hit.payload.content,
      fileId: hit.payload.notebookFileId,
      fileName: validFileNames.get(hit.payload.notebookFileId) || hit.payload.fileName,
      score: hit.score,
    }));

  logBackendProcess('info', 'rag.qdrant.search.completed', {
    candidateLimit,
    elapsedMs: getElapsedMs(searchStartedAt),
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    resultCount: results.length,
  });

  return results;
}

export async function deleteNotebookFileRagIndex(params: {
  fileId: string;
  notebookId: string;
}) {
  try {
    await deleteNotebookChunkPointsByFile({
      collectionName: getQdrantCollectionName(),
      fileId: params.fileId,
      notebookId: params.notebookId,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.file.cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown Qdrant cleanup error',
      fileId: params.fileId,
      notebookId: params.notebookId,
    });
  }
}

export async function deleteNotebookRagIndex(params: {
  notebookId: string;
}) {
  try {
    await deleteNotebookChunkPointsByNotebook({
      collectionName: getQdrantCollectionName(),
      notebookId: params.notebookId,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.notebook.cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown Qdrant cleanup error',
      notebookId: params.notebookId,
    });
  }
}

export function formatRagContextForPrompt(results: RagSearchResult[]) {
  return results
    .map((result, index) => {
      const content = result.content.length > RAG_PROMPT_SOURCE_CHAR_LIMIT
        ? `${result.content.slice(0, RAG_PROMPT_SOURCE_CHAR_LIMIT).trimEnd()}\n[Source excerpt truncated]`
        : result.content;

      return [
        `[SOURCE ${index + 1}: ${result.fileName}, chunk ${result.chunkIndex + 1}, score ${result.score.toFixed(3)}]`,
        content,
      ].join('\n');
    })
    .join('\n\n');
}
