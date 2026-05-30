const { generateEmbeddingMock, queryRawMock } = vi.hoisted(() => ({
  generateEmbeddingMock: vi.fn(),
  queryRawMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRaw: vi.fn(),
    $queryRaw: queryRawMock,
  },
}));

vi.mock('@/lib/embeddings', () => ({
  generateEmbedding: generateEmbeddingMock,
  getEmbeddingModel: vi.fn().mockReturnValue('test-embedding-model'),
}));

import { RAG_VECTOR_DIMENSIONS, retrieveNotebookRagContext, splitIntoChunks } from './rag';

describe('splitIntoChunks', () => {
  it('chunks text with overlap from prior content', () => {
    const text = [
      'First paragraph has enough words to begin a useful chunk for retrieval.',
      'Second paragraph continues the uploaded material with more searchable content.',
      'Third paragraph gives the splitter enough text to form another chunk.',
    ].join('\n\n');

    const chunks = splitIntoChunks(text, 90, 25);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.trim().length > 0)).toBe(true);
    expect(chunks[1]).toContain('retrieval');
  });
});

describe('retrieveNotebookRagContext', () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    generateEmbeddingMock.mockReset();
    generateEmbeddingMock.mockResolvedValue(new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5));
    queryRawMock.mockResolvedValue([]);
  });

  it('casts the indexed subvector dimension to integer in SQL', async () => {
    await retrieveNotebookRagContext({
      limit: 6,
      notebookId: 'nb-1',
      query: 'greedy algorithms',
    });

    expect(queryRawMock).toHaveBeenCalledTimes(1);

    const [strings] = queryRawMock.mock.calls[0] ?? [];
    const sql = Array.isArray(strings) ? strings.join('') : '';

    expect(sql).toContain('subvector(c."embedding", 1, CAST(');
    expect(sql).toContain('AS integer))::');
    expect(sql).toContain('<=> subvector(');
  });
});
