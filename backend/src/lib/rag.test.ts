const {
  deleteNotebookChunkPointsByFileMock,
  deleteNotebookChunkPointsByIdsMock,
  ensureNotebookChunksCollectionMock,
  executeRawMock,
  findManyMock,
  generateEmbeddingMock,
  searchNotebookChunksMock,
  transactionMock,
  upsertNotebookChunkPointsMock,
} = vi.hoisted(() => ({
  deleteNotebookChunkPointsByFileMock: vi.fn(),
  deleteNotebookChunkPointsByIdsMock: vi.fn(),
  ensureNotebookChunksCollectionMock: vi.fn(),
  executeRawMock: vi.fn(),
  findManyMock: vi.fn(),
  generateEmbeddingMock: vi.fn(),
  searchNotebookChunksMock: vi.fn(),
  transactionMock: vi.fn(),
  upsertNotebookChunkPointsMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRaw: executeRawMock,
    $transaction: transactionMock,
    notebookFile: {
      findMany: findManyMock,
    },
  },
}));

vi.mock('@/lib/embeddings', () => ({
  generateEmbedding: generateEmbeddingMock,
  getEmbeddingModel: vi.fn().mockReturnValue('test-embedding-model'),
}));

vi.mock('@/lib/qdrant', () => ({
  deleteNotebookChunkPointsByFile: deleteNotebookChunkPointsByFileMock,
  deleteNotebookChunkPointsByIds: deleteNotebookChunkPointsByIdsMock,
  deleteNotebookChunkPointsByNotebook: vi.fn(),
  ensureNotebookChunksCollection: ensureNotebookChunksCollectionMock,
  getQdrantCollectionName: vi.fn().mockReturnValue('notebook_chunks'),
  searchNotebookChunks: searchNotebookChunksMock,
  upsertNotebookChunkPoints: upsertNotebookChunkPointsMock,
}));

import {
  formatRagContextForPrompt,
  indexNotebookFileForRag,
  RAG_PROMPT_SOURCE_CHAR_LIMIT,
  RAG_VECTOR_DIMENSIONS,
  retrieveNotebookRagContext,
  splitIntoChunks,
} from './rag';

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

describe('indexNotebookFileForRag', () => {
  beforeEach(() => {
    deleteNotebookChunkPointsByFileMock.mockReset();
    deleteNotebookChunkPointsByIdsMock.mockReset();
    ensureNotebookChunksCollectionMock.mockReset();
    executeRawMock.mockReset();
    generateEmbeddingMock.mockReset();
    transactionMock.mockReset();
    upsertNotebookChunkPointsMock.mockReset();
    deleteNotebookChunkPointsByFileMock.mockResolvedValue(undefined);
    deleteNotebookChunkPointsByIdsMock.mockResolvedValue(undefined);
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks');
    executeRawMock.mockReturnValue(Promise.resolve());
    generateEmbeddingMock.mockResolvedValue(new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5));
    transactionMock.mockResolvedValue([]);
    upsertNotebookChunkPointsMock.mockResolvedValue(undefined);
  });

  it('stores chunk embeddings in Qdrant with the required payload fields', async () => {
    const indexed = await indexNotebookFileForRag({
      chunks: [
        {
          content: 'Timestamped video segment',
          metadata: {
            videoTimestampEnd: 30,
            videoTimestampStart: 0,
          },
        },
      ],
      fileId: 'file-1',
      fileName: 'lecture.mp4',
      fileType: 'video',
      notebookId: 'nb-1',
    });

    expect(indexed).toBe(1);
    expect(ensureNotebookChunksCollectionMock).toHaveBeenCalledWith(RAG_VECTOR_DIMENSIONS);
    expect(upsertNotebookChunkPointsMock).toHaveBeenCalledWith({
      collectionName: 'notebook_chunks',
      points: [
        expect.objectContaining({
          payload: {
            notebookId: 'nb-1',
            notebookFileId: 'file-1',
            fileName: 'lecture.mp4',
            fileType: 'video',
            chunkIndex: 0,
            content: 'Timestamped video segment',
            tokenCount: 4,
            pageNumber: null,
            slideNumber: null,
            timestampStart: 0,
            timestampEnd: 30,
            embeddingModel: 'test-embedding-model',
          },
          vector: new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5),
        }),
      ],
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it('deletes inserted Qdrant points when manifest persistence fails', async () => {
    transactionMock.mockRejectedValue(new Error('postgres failed'));

    await expect(indexNotebookFileForRag({
      extractedText: 'Searchable text',
      fileId: 'file-1',
      fileName: 'week-1.txt',
      fileType: 'txt',
      notebookId: 'nb-1',
    })).rejects.toThrow('postgres failed');

    expect(deleteNotebookChunkPointsByIdsMock).toHaveBeenCalledWith({
      collectionName: 'notebook_chunks',
      pointIds: [expect.any(String)],
    });
  });
});

describe('retrieveNotebookRagContext', () => {
  beforeEach(() => {
    ensureNotebookChunksCollectionMock.mockReset();
    findManyMock.mockReset();
    generateEmbeddingMock.mockReset();
    searchNotebookChunksMock.mockReset();
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks');
    generateEmbeddingMock.mockResolvedValue(new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5));
  });

  it('searches Qdrant with notebook and file filters, then validates hits against Postgres', async () => {
    searchNotebookChunksMock.mockResolvedValue([
      {
        payload: {
          notebookId: 'nb-1',
          notebookFileId: 'file-1',
          fileName: 'stale-name.txt',
          fileType: 'txt',
          chunkIndex: 0,
          content: 'Valid chunk',
          tokenCount: 3,
          pageNumber: null,
          slideNumber: null,
          timestampStart: null,
          timestampEnd: null,
          embeddingModel: 'test-embedding-model',
        },
        score: 0.93,
      },
      {
        payload: {
          notebookId: 'nb-1',
          notebookFileId: 'deleted-file',
          fileName: 'deleted.txt',
          fileType: 'txt',
          chunkIndex: 1,
          content: 'Stale chunk',
          tokenCount: 3,
          pageNumber: null,
          slideNumber: null,
          timestampStart: null,
          timestampEnd: null,
          embeddingModel: 'test-embedding-model',
        },
        score: 0.91,
      },
    ]);
    findManyMock.mockResolvedValue([
      {
        id: 'file-1',
        name: 'week-1.txt',
      },
    ]);

    const results = await retrieveNotebookRagContext({
      fileId: 'file-1',
      limit: 6,
      notebookId: 'nb-1',
      query: 'greedy algorithms',
    });

    expect(searchNotebookChunksMock).toHaveBeenCalledWith({
      collectionName: 'notebook_chunks',
      fileId: 'file-1',
      limit: 24,
      notebookId: 'nb-1',
      vector: new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5),
    });
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        notebookId: 'nb-1',
      },
      select: {
        id: true,
        name: true,
      },
    });
    expect(results).toEqual([
      {
        chunkIndex: 0,
        content: 'Valid chunk',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.93,
      },
    ]);
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
