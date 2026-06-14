import { getEmbeddingModelDimensions } from '@/lib/embedding-dimensions';

export function getRagVectorDimensions() {
  return getEmbeddingModelDimensions();
}

export function assertVectorDimensions(vector: number[], expectedDimensions = getRagVectorDimensions()) {
  if (vector.length !== expectedDimensions) {
    throw new Error(`Embedding dimension mismatch. Expected ${expectedDimensions}, received ${vector.length}.`);
  }
}
