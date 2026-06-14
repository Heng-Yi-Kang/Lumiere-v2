import { getEmbeddingModelDimensions, RAG_VECTOR_DIMENSIONS } from './embedding-dimensions';

describe('embedding dimensions', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses EMBEDDING_DIMENSIONS when configured', () => {
    process.env.EMBEDDING_DIMENSIONS = '1536';
    process.env.EMBEDDING_MODEL = 'google/gemini-embedding-2';

    expect(getEmbeddingModelDimensions()).toBe(1536);
  });

  it('infers dimensions for known embedding models when env is not configured', () => {
    delete process.env.EMBEDDING_DIMENSIONS;
    process.env.EMBEDDING_MODEL = 'google/gemini-embedding-2';

    expect(getEmbeddingModelDimensions()).toBe(3072);
  });

  it('falls back to the historical vector size for unknown models', () => {
    delete process.env.EMBEDDING_DIMENSIONS;
    process.env.EMBEDDING_MODEL = 'unknown-embedding-model';

    expect(getEmbeddingModelDimensions()).toBe(RAG_VECTOR_DIMENSIONS);
  });

  it('rejects invalid configured dimensions', () => {
    process.env.EMBEDDING_DIMENSIONS = '0';

    expect(() => getEmbeddingModelDimensions()).toThrow('EMBEDDING_DIMENSIONS must be a positive integer.');
  });
});
