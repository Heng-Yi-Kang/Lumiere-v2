export const RAG_VECTOR_DIMENSIONS = 4096;

const KNOWN_EMBEDDING_MODEL_DIMENSIONS = new Map<string, number>([
  ['google/gemini-embedding-2', 3072],
  ['gemini-embedding-2', 3072],
]);

function parseConfiguredEmbeddingDimensions(value: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('EMBEDDING_DIMENSIONS must be a positive integer.');
  }

  return parsedValue;
}

export function getEmbeddingModelDimensions(params?: {
  embeddingDimensions?: string;
  embeddingModel?: string;
}) {
  const configuredValue = params?.embeddingDimensions ?? process.env.EMBEDDING_DIMENSIONS?.trim();

  if (configuredValue) {
    return parseConfiguredEmbeddingDimensions(configuredValue);
  }

  const embeddingModel = (params?.embeddingModel ?? process.env.EMBEDDING_MODEL)?.trim().toLowerCase();
  if (embeddingModel) {
    const knownDimensions = KNOWN_EMBEDDING_MODEL_DIMENSIONS.get(embeddingModel);

    if (knownDimensions) {
      return knownDimensions;
    }
  }

  return RAG_VECTOR_DIMENSIONS;
}
