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
import { isRerankingEnabled, rerankDocuments } from '@/lib/reranker';

export const RAG_CHUNK_SIZE = 650;
export const RAG_CHUNK_OVERLAP = 120;
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
  rerankScore: number | null;
  score: number;
  vectorScore: number;
};

export type RagIndexChunk = {
  content: string;
  metadata?: Record<string, unknown>;
};

type DiversifyRagResultsOptions = {
  maxChunks?: number;
  maxChunksPerFile?: number;
  preserveTopN?: number;
  scoreTolerance?: number;
};

type RagChunkMetadata = {
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

type RankedRagSearchResult = RagSearchResult & {
  originalIndex: number;
};

type ChunkUnitType = 'code' | 'equation' | 'heading' | 'list' | 'page' | 'paragraph' | 'slide' | 'table';

type ChunkUnit = {
  endOffset: number;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    slideNumber?: number;
  };
  startOffset: number;
  text: string;
  type: ChunkUnitType;
};

function cleanText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function estimateTokenCount(text: string) {
  const value = text.trim();

  if (!value) {
    return 0;
  }

  // Compatible with tokenizer behaviour closely enough for chunk sizing without
  // adding a runtime dependency: words undercount punctuation/code, chars cap CJK.
  const wordEstimate = value.split(/\s+/).filter(Boolean).length * 1.3;
  const charEstimate = value.length / 4;
  return Math.ceil(Math.max(wordEstimate, charEstimate));
}

function lineOffset(line: string, startOffset: number) {
  return {
    endOffset: startOffset + line.length,
    startOffset,
  };
}

function getHeadingTitle(line: string) {
  const markdownHeading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);

  if (markdownHeading?.[1]) {
    return markdownHeading[1].trim();
  }

  return null;
}

function getPageNumber(line: string) {
  const match = line.match(/^\s*(?:-{2,}\s*)?(?:\[?\s*)page\s+(\d+)(?:\s*\]?)?(?:\s*-{2,})?\s*$/i);
  return match?.[1] ? Number(match[1]) : null;
}

function getSlideNumber(line: string) {
  const match = line.match(/^\s*(?:-{2,}\s*)?(?:\[?\s*)slide\s+(\d+)(?:\s*\]?)?(?:\s*-{2,})?\s*$/i);
  return match?.[1] ? Number(match[1]) : null;
}

function isBulletLine(line: string) {
  return /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line);
}

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.split('|').length >= 3;
}

function isEquationLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith('$$') || trimmed.endsWith('$$') || /^\\\[|\\\]$/.test(trimmed);
}

function buildUnit(lines: Array<{ endOffset: number; startOffset: number; text: string }>, type: ChunkUnitType, metadata: ChunkUnit['metadata']): ChunkUnit {
  const text = lines.map((line) => line.text).join('\n').trim();
  return {
    endOffset: lines[lines.length - 1]?.endOffset ?? 0,
    metadata: { ...metadata },
    startOffset: lines[0]?.startOffset ?? 0,
    text,
    type,
  };
}

function parseChunkUnits(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
  const leadingWhitespace = normalized.match(/^\s*/)?.[0].length ?? 0;
  const source = cleanText(normalized);

  if (!source) {
    return [];
  }

  const lines = source.split('\n');
  const units: ChunkUnit[] = [];
  let cursor = leadingWhitespace;
  let pageNumber: number | undefined;
  let sectionTitle: string | undefined;
  let slideNumber: number | undefined;

  function metadata() {
    return {
      ...(pageNumber !== undefined ? { pageNumber } : {}),
      ...(sectionTitle ? { sectionTitle } : {}),
      ...(slideNumber !== undefined ? { slideNumber } : {}),
    };
  }

  for (let index = 0; index < lines.length;) {
    const line = lines[index] || '';
    const offsets = lineOffset(line, cursor);
    cursor += line.length + 1;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingTitle = getHeadingTitle(line);
    if (headingTitle) {
      sectionTitle = headingTitle;
      units.push(buildUnit([{ ...offsets, text: line }], 'heading', metadata()));
      index += 1;
      continue;
    }

    const nextPageNumber = getPageNumber(line);
    if (nextPageNumber !== null) {
      pageNumber = nextPageNumber;
      units.push(buildUnit([{ ...offsets, text: line }], 'page', metadata()));
      index += 1;
      continue;
    }

    const nextSlideNumber = getSlideNumber(line);
    if (nextSlideNumber !== null) {
      slideNumber = nextSlideNumber;
      units.push(buildUnit([{ ...offsets, text: line }], 'slide', metadata()));
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;

        if (blockLine.trim().startsWith('```')) {
          break;
        }
      }
      units.push(buildUnit(block, 'code', metadata()));
      continue;
    }

    if (isBulletLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && (isBulletLine(lines[index] || '') || /^\s{2,}\S/.test(lines[index] || ''))) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'list', metadata()));
      continue;
    }

    if (isTableLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && isTableLine(lines[index] || '')) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'table', metadata()));
      continue;
    }

    if (isEquationLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && !isEquationLine(lines[index] || '')) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      if (index < lines.length) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'equation', metadata()));
      continue;
    }

    const block = [{ ...offsets, text: line }];
    index += 1;
    while (index < lines.length && lines[index]?.trim()) {
      const paragraphLine = lines[index] || '';

      if (
        getHeadingTitle(paragraphLine)
        || getPageNumber(paragraphLine) !== null
        || getSlideNumber(paragraphLine) !== null
        || paragraphLine.trim().startsWith('```')
        || isBulletLine(paragraphLine)
        || isTableLine(paragraphLine)
        || isEquationLine(paragraphLine)
      ) {
        break;
      }

      const paragraphOffsets = lineOffset(paragraphLine, cursor);
      cursor += paragraphLine.length + 1;
      block.push({ ...paragraphOffsets, text: paragraphLine });
      index += 1;
    }
    units.push(buildUnit(block, 'paragraph', metadata()));
  }

  return units;
}

function splitParagraphUnit(unit: ChunkUnit, maxTokens: number): ChunkUnit[] {
  const sentences = unit.text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g)?.map((value) => value.trim()).filter(Boolean) || [unit.text];

  if (sentences.length <= 1) {
    return [unit];
  }

  const units: ChunkUnit[] = [];
  let searchOffset = unit.startOffset;

  for (const sentence of sentences) {
    const sentenceStart = Math.max(unit.startOffset, unit.text.indexOf(sentence, searchOffset - unit.startOffset) + unit.startOffset);
    const sentenceEnd = sentenceStart + sentence.length;
    searchOffset = sentenceEnd;

    if (estimateTokenCount(sentence) > maxTokens) {
      const words = sentence.split(/\s+/).filter(Boolean);
      let current = '';
      let currentStart = sentenceStart;

      for (const word of words) {
        const candidate = `${current} ${word}`.trim();
        if (current && estimateTokenCount(candidate) > maxTokens) {
          units.push({
            ...unit,
            endOffset: currentStart + current.length,
            startOffset: currentStart,
            text: current,
          });
          currentStart = sentenceStart + sentence.indexOf(word, Math.max(0, currentStart - sentenceStart));
          current = word;
          continue;
        }
        current = candidate;
      }

      if (current) {
        units.push({
          ...unit,
          endOffset: currentStart + current.length,
          startOffset: currentStart,
          text: current,
        });
      }
      continue;
    }

    units.push({
      ...unit,
      endOffset: sentenceEnd,
      startOffset: sentenceStart,
      text: sentence,
    });
  }

  return units;
}

function formatUnits(units: ChunkUnit[]) {
  return units.map((unit) => unit.text).join('\n\n').trim();
}

function buildChunk(units: ChunkUnit[]): RagIndexChunk | null {
  const content = formatUnits(units);

  if (!content) {
    return null;
  }

  const metadata = units.reduce<Record<string, unknown>>((accumulator, unit) => ({
    ...accumulator,
    ...unit.metadata,
  }), {});

  return {
    content,
    metadata: {
      ...metadata,
      sourceEndOffset: Math.max(...units.map((unit) => unit.endOffset)),
      sourceStartOffset: Math.min(...units.map((unit) => unit.startOffset)),
    },
  };
}

function takeOverlapUnits(units: ChunkUnit[], overlapTokens: number) {
  if (!overlapTokens) {
    return [];
  }

  const overlapUnits: ChunkUnit[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) {
      continue;
    }

    const nextTokens = tokens + estimateTokenCount(unit.text);
    if (overlapUnits.length && nextTokens > overlapTokens) {
      break;
    }

    overlapUnits.unshift(unit);
    tokens = nextTokens;
  }

  return overlapUnits;
}

function normalizeChunkTokenCount(value: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

export function splitIntoRagChunks(text: string, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP): RagIndexChunk[] {
  const targetTokens = normalizeChunkTokenCount(chunkSize, RAG_CHUNK_SIZE);
  const overlapTokens = Math.min(normalizeChunkTokenCount(overlap, RAG_CHUNK_OVERLAP), Math.floor(targetTokens / 2));
  const maxTokens = Math.max(targetTokens, Math.ceil(targetTokens * 1.25));
  const units = parseChunkUnits(text).flatMap((unit) =>
    unit.type === 'paragraph' && estimateTokenCount(unit.text) > maxTokens
      ? splitParagraphUnit(unit, maxTokens)
      : [unit],
  );
  const chunks: RagIndexChunk[] = [];
  let currentUnits: ChunkUnit[] = [];

  function flush() {
    const chunk = buildChunk(currentUnits);
    if (chunk) {
      chunks.push(chunk);
      currentUnits = takeOverlapUnits(currentUnits, overlapTokens);
      return;
    }
    currentUnits = [];
  }

  for (const unit of units) {
    const isStructuralBoundary = unit.type === 'heading' || unit.type === 'page' || unit.type === 'slide';
    const hasContentBeforeBoundary = currentUnits.some((currentUnit) =>
      currentUnit.type !== 'page' && currentUnit.type !== 'slide',
    );
    const candidateUnits = [...currentUnits, unit];
    const candidateTokens = estimateTokenCount(formatUnits(candidateUnits));

    if (isStructuralBoundary && hasContentBeforeBoundary) {
      flush();
    } else if (currentUnits.length && candidateTokens > maxTokens) {
      flush();
    }

    currentUnits.push(unit);
  }

  flush();
  return chunks;
}

export function splitIntoChunks(text: string, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP) {
  return splitIntoRagChunks(text, chunkSize, overlap).map((chunk) => chunk.content);
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

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeNonNegativeNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function diversifyRagResults(
  results: RagSearchResult[],
  options: DiversifyRagResultsOptions = {},
) {
  const maxChunks = normalizePositiveInteger(options.maxChunks, 6);
  const maxChunksPerFile = normalizePositiveInteger(options.maxChunksPerFile, 3);
  const preserveTopN = Math.max(0, Math.floor(options.preserveTopN ?? 1));
  const scoreTolerance = normalizeNonNegativeNumber(options.scoreTolerance, 0.03);
  const rankedResults = results
    .map((result, originalIndex) => ({ result, originalIndex }))
    .sort((a, b) => b.result.score - a.result.score || a.originalIndex - b.originalIndex);

  const selected: typeof rankedResults = [];
  const selectedIndexes = new Set<number>();
  const chunksByFile = new Map<string, number>();

  function canSelect(candidate: (typeof rankedResults)[number]) {
    return !selectedIndexes.has(candidate.originalIndex)
      && (chunksByFile.get(candidate.result.fileId) || 0) < maxChunksPerFile;
  }

  function select(candidate: (typeof rankedResults)[number]) {
    selected.push(candidate);
    selectedIndexes.add(candidate.originalIndex);
    chunksByFile.set(candidate.result.fileId, (chunksByFile.get(candidate.result.fileId) || 0) + 1);
  }

  for (const candidate of rankedResults) {
    if (selected.length >= Math.min(preserveTopN, maxChunks)) {
      break;
    }

    if (canSelect(candidate)) {
      select(candidate);
    }
  }

  while (selected.length < maxChunks) {
    const eligible = rankedResults.filter(canSelect);
    const best = eligible[0];

    if (!best) {
      break;
    }

    const closeCandidates = eligible.filter(
      (candidate) => best.result.score - candidate.result.score <= scoreTolerance,
    );
    const differentFileCandidate = closeCandidates.find(
      (candidate) => !chunksByFile.has(candidate.result.fileId),
    );

    select(differentFileCandidate || best);
  }

  return selected.map((candidate) => candidate.result);
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
    fileId: params.fileId,
    fileName: params.fileName,
    notebookId: params.notebookId,
  });

  return chunks.length;
}

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
  assertVectorDimensions(embedding);
  logBackendProcess('info', 'rag.search.embedding.completed', {
    embeddingDims: embedding.length,
    elapsedMs: getElapsedMs(embeddingStartedAt),
    notebookId: options.notebookId,
  });

  const candidateLimit = rerankingEnabled
    ? Math.min(Math.max(limit * 10, 50), 100)
    : Math.min(Math.max(limit * 4, 20), 100);
  const collectionName = await ensureNotebookChunksCollection(RAG_VECTOR_DIMENSIONS);

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
      rerankScore: null,
      score: hit.score,
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
        [
          `[SOURCE ${index + 1}: ${result.fileName}, chunk ${result.chunkIndex + 1}, score ${result.score.toFixed(3)}`,
          `vectorScore ${result.vectorScore.toFixed(3)}`,
          `rerankScore ${result.rerankScore === null ? 'n/a' : result.rerankScore.toFixed(3)}]`,
        ].join(', '),
        content,
      ].join('\n');
    })
    .join('\n\n');
}
