import type { NotebookChunkPayload } from '@/lib/qdrant';
import { estimateTokenCount } from '@/lib/rag/chunking';
import type { RagChunkMetadata, RagIndexChunk } from '@/lib/rag/types';

function nullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildChunkPayload(params: {
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

export function isNotebookChunkPayload(value: unknown): value is NotebookChunkPayload {
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
