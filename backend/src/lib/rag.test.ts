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

import { formatRagContextForPrompt, RAG_PROMPT_SOURCE_CHAR_LIMIT, RAG_VECTOR_DIMENSIONS, retrieveNotebookRagContext, splitIntoChunks } from './rag';

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

describe('formatRagContextForPrompt', () => {
  it('trims oversized source content before sending it to chat generation', () => {
    const context = formatRagContextForPrompt([
      {
        chunkIndex: 0,
        content: 'a'.repeat(RAG_PROMPT_SOURCE_CHAR_LIMIT + 500),
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.95,
      },
    ]);

    expect(context).toContain('[SOURCE 1: week-1.txt, chunk 1, score 0.950]');
    expect(context).toContain('[Source excerpt truncated]');
    expect(context.length).toBeLessThan(RAG_PROMPT_SOURCE_CHAR_LIMIT + 120);
  });
});
