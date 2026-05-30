import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { getEmbeddingModel, generateEmbedding } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';

export const RAG_CHUNK_SIZE = 2000;
export const RAG_CHUNK_OVERLAP = 400;
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
  const chunks = splitIntoChunks(params.extractedText || '');

  if (!chunks.length) {
    return 0;
  }

  const embeddingModel = getEmbeddingModel();

  for (const [chunkIndex, content] of chunks.entries()) {
    const embedding = await generateEmbedding(content);
    assertVectorDimensions(embedding);

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
  }

  return chunks.length;
}

export async function retrieveNotebookRagContext(options: RagSearchOptions) {
  const limit = Math.min(Math.max(options.limit || 5, 1), 20);
  const embedding = await generateEmbedding(options.query);
  assertVectorDimensions(embedding);
  const vector = toVectorLiteral(embedding);
  const fileFilter = options.fileId ? Prisma.sql`AND c."notebookFileId" = ${options.fileId}` : Prisma.empty;

  return prisma.$queryRaw<RagSearchResult[]>`
    SELECT
      c."notebookFileId" AS "fileId",
      f."name" AS "fileName",
      c."chunkIndex",
      c."content",
      1 - (c."embedding" <=> ${vector}::vector) AS "score"
    FROM "NotebookFileChunk" c
    INNER JOIN "NotebookFile" f ON f."id" = c."notebookFileId"
    WHERE c."notebookId" = ${options.notebookId}
      ${fileFilter}
    ORDER BY c."embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `;
}

export function formatRagContextForPrompt(results: RagSearchResult[]) {
  return results
    .map((result, index) => [
      `[SOURCE ${index + 1}: ${result.fileName}, chunk ${result.chunkIndex + 1}, score ${result.score.toFixed(3)}]`,
      result.content,
    ].join('\n'))
    .join('\n\n');
}
