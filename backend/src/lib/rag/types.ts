export type RagSearchOptions = {
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
  pageNumber?: number | null;
  rerankScore: number | null;
  score: number;
  slideNumber?: number | null;
  timestampEnd?: number | null;
  timestampStart?: number | null;
  vectorScore: number;
};

export type RagIndexChunk = {
  content: string;
  metadata?: Record<string, unknown>;
};

export type DiversifyRagResultsOptions = {
  maxChunks?: number;
  maxChunksPerFile?: number;
  preserveTopN?: number;
  scoreTolerance?: number;
};

export type RagChunkMetadata = {
  pageNumber?: unknown;
  sectionTitle?: unknown;
  slideNumber?: unknown;
  sourceEndOffset?: unknown;
  sourceStartOffset?: unknown;
  timestampEnd?: unknown;
  timestampStart?: unknown;
  videoTimestampEnd?: unknown;
  videoTimestampStart?: unknown;
};

export type RankedRagSearchResult = RagSearchResult & {
  originalIndex: number;
};
