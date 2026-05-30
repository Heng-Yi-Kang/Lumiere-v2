type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

export class EmbeddingError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new EmbeddingError(`${name} is required for embedding generation.`);
  }

  return value;
}

function buildEmbeddingsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/embeddings`;
}

function normalizeEmbedding(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new EmbeddingError('Embedding provider returned an empty vector.');
  }

  return values.map((value) => value / magnitude);
}

export function getEmbeddingModel() {
  return getRequiredEnv('EMBEDDING_MODEL');
}

export async function generateEmbedding(input: string) {
  const baseUrl = getRequiredEnv('EMBEDDING_API_BASE');
  const apiKey = getRequiredEnv('EMBEDDING_API_KEY');
  const model = getEmbeddingModel();
  const response = await fetch(buildEmbeddingsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: input.slice(0, 8000),
      model,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new EmbeddingError(`Embedding request failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as EmbeddingResponse;
  const embedding = payload.data?.[0]?.embedding;

  if (!embedding?.length) {
    throw new EmbeddingError('Embedding provider returned no vector data.');
  }

  return normalizeEmbedding(embedding);
}
