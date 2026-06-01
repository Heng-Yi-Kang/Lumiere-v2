type RerankResponseItem = {
  index?: unknown;
  score?: unknown;
};

export class RerankerError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new RerankerError(`${name} is required when reranking is enabled.`);
  }

  return value;
}

function buildRerankUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/rerank`;
}

export function isRerankingEnabled() {
  return process.env.ENABLE_RERANKING?.trim().toLowerCase() === 'true';
}

export function getRerankerModel() {
  return getRequiredEnv('RERANKER_MODEL');
}

export async function rerankDocuments(params: {
  documents: string[];
  query: string;
}) {
  if (!params.documents.length) {
    return [];
  }

  const baseUrl = getRequiredEnv('RERANKER_API_BASE');
  const apiKey = getRequiredEnv('RERANKER_API_KEY');
  const model = getRerankerModel();
  const response = await fetch(buildRerankUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      query: params.query,
      texts: params.documents,
      truncate: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new RerankerError(`Reranker request failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) {
    throw new RerankerError('Reranker provider returned a non-array response.');
  }

  const scores = new Array<number>(params.documents.length);
  const seenIndexes = new Set<number>();

  for (const item of payload as RerankResponseItem[]) {
    const index = item.index;
    const score = item.score;

    if (
      typeof index !== 'number'
      || !Number.isInteger(index)
      || index < 0
      || index >= params.documents.length
      || seenIndexes.has(index)
      || typeof score !== 'number'
      || !Number.isFinite(score)
    ) {
      throw new RerankerError('Reranker provider returned malformed score data.');
    }

    scores[index] = score;
    seenIndexes.add(index);
  }

  if (seenIndexes.size !== params.documents.length) {
    throw new RerankerError('Reranker provider returned incomplete score data.');
  }

  return scores;
}
