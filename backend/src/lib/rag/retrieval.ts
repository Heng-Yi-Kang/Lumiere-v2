import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { generateEmbedding } from '@/lib/embeddings';
import { prisma } from '@/lib/prisma';
import { type NotebookChunkPayload, ensureNotebookChunksCollection, searchNotebookChunks } from '@/lib/qdrant';
import { isNotebookChunkPayload } from '@/lib/rag/payload';
import type { RagSearchOptions, RankedRagSearchResult } from '@/lib/rag/types';
import { assertVectorDimensions, getRagVectorDimensions } from '@/lib/rag/vector-dimensions';
import { isRerankingEnabled, rerankDocuments } from '@/lib/reranker';

export async function retrieveNotebookRagContext(options: RagSearchOptions) {
  const searchStartedAt = performance.now();
  const limit = Math.min(Math.max(options.limit || 5, 1), 20);
  const rerankingEnabled = isRerankingEnabled();
  logBackendProcess('info', 'rag.search.started', {
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    queryChars: options.query.length,
    rerankingEnabled,
  });

  const embeddingStartedAt = performance.now();
  logBackendProcess('info', 'rag.search.embedding.started', {
    notebookId: options.notebookId,
    queryChars: options.query.length,
  });

  const embedding = await generateEmbedding(options.query);
  const vectorDimensions = getRagVectorDimensions();
  assertVectorDimensions(embedding, vectorDimensions);
  logBackendProcess('info', 'rag.search.embedding.completed', {
    embeddingDims: embedding.length,
    elapsedMs: getElapsedMs(embeddingStartedAt),
    notebookId: options.notebookId,
    vectorDimensions,
  });

  const candidateLimit = rerankingEnabled
    ? Math.min(Math.max(limit * 10, 50), 100)
    : Math.min(Math.max(limit * 4, 20), 100);
  const collectionName = await ensureNotebookChunksCollection(vectorDimensions);

  logBackendProcess('info', 'rag.qdrant.search.started', {
    candidateLimit,
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    rerankingEnabled,
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
  const vectorRankedResults: RankedRagSearchResult[] = payloads
    .filter((hit) => validFileNames.has(hit.payload.notebookFileId))
    .map((hit, originalIndex) => ({
      chunkIndex: hit.payload.chunkIndex,
      content: hit.payload.content,
      fileId: hit.payload.notebookFileId,
      fileName: validFileNames.get(hit.payload.notebookFileId) || hit.payload.fileName,
      originalIndex,
      ...(hit.payload.pageNumber !== null ? { pageNumber: hit.payload.pageNumber } : {}),
      rerankScore: null,
      score: hit.score,
      ...(hit.payload.slideNumber !== null ? { slideNumber: hit.payload.slideNumber } : {}),
      ...(hit.payload.timestampEnd !== null ? { timestampEnd: hit.payload.timestampEnd } : {}),
      ...(hit.payload.timestampStart !== null ? { timestampStart: hit.payload.timestampStart } : {}),
      vectorScore: hit.score,
    }));
  let rankedResults = vectorRankedResults;

  if (rerankingEnabled && vectorRankedResults.length) {
    const rerankStartedAt = performance.now();
    try {
      logBackendProcess('info', 'rag.rerank.started', {
        candidateCount: vectorRankedResults.length,
        fileId: options.fileId,
        limit,
        notebookId: options.notebookId,
      });
      const rerankScores = await rerankDocuments({
        documents: vectorRankedResults.map((result) => result.content),
        query: options.query,
      });

      rankedResults = vectorRankedResults
        .map((result, index) => ({
          ...result,
          rerankScore: rerankScores[index],
          score: rerankScores[index],
        }))
        .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);

      logBackendProcess('info', 'rag.rerank.completed', {
        candidateCount: vectorRankedResults.length,
        elapsedMs: getElapsedMs(rerankStartedAt),
        fileId: options.fileId,
        limit,
        notebookId: options.notebookId,
      });
    } catch (error) {
      logBackendProcess('warn', 'rag.rerank.failed', {
        candidateCount: vectorRankedResults.length,
        elapsedMs: getElapsedMs(rerankStartedAt),
        error: error instanceof Error ? error.message : 'Unknown reranker error',
        fileId: options.fileId,
        limit,
        notebookId: options.notebookId,
      });
    }
  }

  const results = rankedResults
    .slice(0, limit)
    .map(({ originalIndex: _originalIndex, ...result }) => result);

  logBackendProcess('info', 'rag.qdrant.search.completed', {
    candidateLimit,
    elapsedMs: getElapsedMs(searchStartedAt),
    fileId: options.fileId,
    limit,
    notebookId: options.notebookId,
    rerankingEnabled,
    resultCount: results.length,
  });

  return results;
}
