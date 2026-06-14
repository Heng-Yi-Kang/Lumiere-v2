import type { DiversifyRagResultsOptions, RagSearchResult } from '@/lib/rag/types';

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
