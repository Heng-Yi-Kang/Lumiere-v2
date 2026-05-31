import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getEmbeddingModel, generateEmbedding } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';

export const RAG_CHUNK_SIZE = 2000;
export const RAG_CHUNK_OVERLAP = 400;
export const RAG_PROMPT_SOURCE_CHAR_LIMIT = 1200;
export const RAG_VECTOR_DIMENSIONS = 4096;
export const RAG_INDEX_SUBVECTOR_DIMENSIONS = 2000;

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

function toVectorLiteral(vector: number[]) {
  return `[${vector.join(',')}]`;
}

function assertVectorDimensions(vector: number[]) {
  if (vector.length !== RAG_VECTOR_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch. Expected ${RAG_VECTOR_DIMENSIONS}, received ${vector.length}.`);
  }
}

export async function indexNotebookFileForRag(params: {
  extractedText?: string | null;
  fileId: string;
  fileName: string;
  fileType: string;
  notebookId: string;
}) {
  const indexingStartedAt = performance.now();
  const chunks = splitIntoChunks(params.extractedText || '');

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

  for (const [chunkIndex, content] of chunks.entries()) {
    const chunkStartedAt = performance.now();
    logBackendProcess('info', 'rag.embedding.started', {
      chunkIndex,
      chunkTextChars: content.length,
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
    });

    const embedding = await generateEmbedding(content);
    assertVectorDimensions(embedding);

    logBackendProcess('info', 'rag.embedding.completed', {
      chunkIndex,
      embeddingDims: embedding.length,
      elapsedMs: getElapsedMs(chunkStartedAt),
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
    });

    await prisma.$executeRaw`
      INSERT INTO "NotebookFileChunk" (
        "id",
        "notebookId",
        "notebookFileId",
        "chunkIndex",
        "content",
        "tokenCount",
        "metadata",
        "embedding",
        "embeddingModel",
        "embeddingDims",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${params.notebookId},
        ${params.fileId},
        ${chunkIndex},
        ${content},
        ${estimateTokenCount(content)},
        ${JSON.stringify({ fileName: params.fileName, fileType: params.fileType })}::jsonb,
        ${toVectorLiteral(embedding)}::vector,
        ${embeddingModel},
        ${embedding.length},
        NOW()
      )
    `;

    logBackendProcess('info', 'rag.chunk.stored', {
      chunkIndex,
      elapsedMs: getElapsedMs(chunkStartedAt),
      fileId: params.fileId,
      fileName: params.fileName,
      notebookId: params.notebookId,
      tokenCount: estimateTokenCount(content),
    });
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

  const vector = toVectorLiteral(embedding);
  const candidateLimit = Math.min(Math.max(limit * 4, 20), 100);
  const indexedSubvectorCast = Prisma.raw(`vector(${RAG_INDEX_SUBVECTOR_DIMENSIONS})`);
  const fileFilter = options.fileId ? Prisma.sql`AND c."notebookFileId" = ${options.fileId}` : Prisma.empty;

  logBackendProcess('info', 'rag.database.search.started', {
    candidateLimit,
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
  });

  const results = await prisma.$queryRaw<RagSearchResult[]>`
    WITH candidate_chunks AS MATERIALIZED (
      SELECT
        c."id",
        c."notebookFileId",
        c."chunkIndex",
        c."content",
        c."embedding"
      FROM "NotebookFileChunk" c
      WHERE c."notebookId" = ${options.notebookId}
        ${fileFilter}
      ORDER BY subvector(c."embedding", 1, CAST(${RAG_INDEX_SUBVECTOR_DIMENSIONS} AS integer))::${indexedSubvectorCast}
        <=> subvector(${vector}::vector, 1, CAST(${RAG_INDEX_SUBVECTOR_DIMENSIONS} AS integer))::${indexedSubvectorCast}
      LIMIT ${candidateLimit}
    )
    SELECT
      c."notebookFileId" AS "fileId",
      f."name" AS "fileName",
      c."chunkIndex",
      c."content",
      1 - (c."embedding" <=> ${vector}::vector) AS "score"
    FROM candidate_chunks c
    INNER JOIN "NotebookFile" f ON f."id" = c."notebookFileId"
    ORDER BY c."embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `;

  logBackendProcess('info', 'rag.database.search.completed', {
    candidateLimit,
    elapsedMs: getElapsedMs(searchStartedAt),
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    resultCount: results.length,
  });

  return results;
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
