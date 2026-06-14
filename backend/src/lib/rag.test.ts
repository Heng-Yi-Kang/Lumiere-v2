const {
  deleteNotebookChunkPointsByFileMock,
  deleteNotebookChunkPointsByIdsMock,
  deleteNotebookChunkPointsByNotebookMock,
  ensureNotebookChunksCollectionMock,
  executeRawMock,
  findManyMock,
  generateEmbeddingMock,
  isRerankingEnabledMock,
  rerankDocumentsMock,
  searchNotebookChunksMock,
  transactionMock,
  upsertNotebookChunkPointsMock,
} = vi.hoisted(() => ({
  deleteNotebookChunkPointsByFileMock: vi.fn(),
  deleteNotebookChunkPointsByIdsMock: vi.fn(),
  deleteNotebookChunkPointsByNotebookMock: vi.fn(),
  ensureNotebookChunksCollectionMock: vi.fn(),
  executeRawMock: vi.fn(),
  findManyMock: vi.fn(),
  generateEmbeddingMock: vi.fn(),
  isRerankingEnabledMock: vi.fn(),
  rerankDocumentsMock: vi.fn(),
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
  deleteNotebookChunkPointsByNotebook: deleteNotebookChunkPointsByNotebookMock,
  ensureNotebookChunksCollection: ensureNotebookChunksCollectionMock,
  getQdrantCollectionNameForDimensions: vi.fn((vectorSize: number) =>
    vectorSize === 4096 ? 'notebook_chunks' : `notebook_chunks_${vectorSize}`,
  ),
  searchNotebookChunks: searchNotebookChunksMock,
  upsertNotebookChunkPoints: upsertNotebookChunkPointsMock,
}));

vi.mock('@/lib/reranker', () => ({
  isRerankingEnabled: isRerankingEnabledMock,
  rerankDocuments: rerankDocumentsMock,
}));

import {
  diversifyRagResults,
  deleteNotebookFileRagIndex,
  deleteNotebookRagIndex,
  formatRagContextForPrompt,
  indexNotebookFileForRag,
  RAG_PROMPT_SOURCE_CHAR_LIMIT,
  RAG_VECTOR_DIMENSIONS,
  getRagVectorDimensions,
  retrieveNotebookRagContext,
  splitIntoChunks,
  splitIntoRagChunks,
} from './rag';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function ragResult(fileId: string, chunkIndex: number, score: number) {
  return {
    chunkIndex,
    content: `${fileId} chunk ${chunkIndex}`,
    fileId,
    fileName: `${fileId}.txt`,
    rerankScore: null,
    score,
    vectorScore: score,
  };
}

describe('splitIntoChunks', () => {
  it('chunks text with overlap from prior content', () => {
    const text = [
      'First paragraph has enough words to begin a useful chunk for retrieval.',
      'Second paragraph continues the uploaded material with more searchable content.',
      'Third paragraph gives the splitter enough text to form another chunk.',
    ].join('\n\n');

    const chunks = splitIntoChunks(text, 20, 8);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.trim().length > 0)).toBe(true);
    expect(chunks[1]).toContain('retrieval');
  });

  it('splits long paragraphs by sentences using token-aware sizing', () => {
    const text = Array.from({ length: 12 }, (_, index) =>
      `Sentence ${index + 1} explains retrieval planning with enough terms to exceed the chunk target cleanly.`,
    ).join(' ');

    const chunks = splitIntoChunks(text, 35, 8);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length < text.length)).toBe(true);
    expect(chunks.every((chunk) => /[.!?]$/.test(chunk.trim()))).toBe(true);
  });

  it('uses headings as section boundaries and preserves structural metadata', () => {
    const chunks = splitIntoRagChunks([
      '--- Page 2 ---',
      '# Neural Retrieval',
      'Dense embeddings connect a question to relevant source material.',
      '',
      'Slide 4',
      '## Reranking',
      'Cross encoders can improve precision after vector search.',
    ].join('\n'), 24, 6);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]?.metadata).toEqual(expect.objectContaining({
      pageNumber: 2,
      sectionTitle: 'Neural Retrieval',
      sourceEndOffset: expect.any(Number),
      sourceStartOffset: expect.any(Number),
    }));
    expect(chunks.at(-1)?.metadata).toEqual(expect.objectContaining({
      pageNumber: 2,
      sectionTitle: 'Reranking',
      slideNumber: 4,
    }));
  });

  it('keeps bullet lists together instead of splitting list items across chunks', () => {
    const list = [
      '- Capture the learner question before retrieval.',
      '- Retrieve evidence from uploaded lecture notes.',
      '- Rerank passages before answer synthesis.',
      '- Cite the selected notebook chunks.',
    ].join('\n');
    const text = [
      'Introductory context fills the first retrieval chunk with terms and definitions.',
      list,
      'Closing context can move independently after the list.',
    ].join('\n\n');

    const chunks = splitIntoChunks(text, 25, 5);
    const listChunk = chunks.find((chunk) => chunk.includes('- Capture the learner question'));

    expect(listChunk).toBeDefined();
    expect(listChunk).toContain('- Cite the selected notebook chunks.');
  });

  it('splits oversized sections while carrying the active section title', () => {
    const oversizedSection = [
      '# Oversized Topic',
      Array.from({ length: 16 }, (_, index) =>
        `Detailed sentence ${index + 1} describes a retrieval edge case with semantic boundaries and stable overlap.`,
      ).join(' '),
    ].join('\n');

    const chunks = splitIntoRagChunks(oversizedSection, 35, 8);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.metadata?.sectionTitle === 'Oversized Topic')).toBe(true);
  });
});

describe('indexNotebookFileForRag', () => {
  beforeEach(() => {
    deleteNotebookChunkPointsByFileMock.mockReset();
    deleteNotebookChunkPointsByIdsMock.mockReset();
    deleteNotebookChunkPointsByNotebookMock.mockReset();
    ensureNotebookChunksCollectionMock.mockReset();
    executeRawMock.mockReset();
    generateEmbeddingMock.mockReset();
    transactionMock.mockReset();
    upsertNotebookChunkPointsMock.mockReset();
    deleteNotebookChunkPointsByFileMock.mockResolvedValue(undefined);
    deleteNotebookChunkPointsByIdsMock.mockResolvedValue(undefined);
    deleteNotebookChunkPointsByNotebookMock.mockResolvedValue(undefined);
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks');
    executeRawMock.mockReturnValue(Promise.resolve());
    generateEmbeddingMock.mockResolvedValue(new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5));
    transactionMock.mockResolvedValue([]);
    upsertNotebookChunkPointsMock.mockResolvedValue(undefined);
    process.env.EMBEDDING_MODEL = 'test-embedding-model';
    delete process.env.EMBEDDING_DIMENSIONS;
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
            tokenCount: 7,
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

  it('uses configured embedding dimensions for indexing', async () => {
    process.env.EMBEDDING_DIMENSIONS = '3072';
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks_3072');
    generateEmbeddingMock.mockResolvedValue(new Array<number>(3072).fill(0.5));

    await indexNotebookFileForRag({
      extractedText: 'Searchable text',
      fileId: 'file-1',
      fileName: 'week-1.txt',
      fileType: 'txt',
      notebookId: 'nb-1',
    });

    expect(getRagVectorDimensions()).toBe(3072);
    expect(ensureNotebookChunksCollectionMock).toHaveBeenCalledWith(3072);
    expect(upsertNotebookChunkPointsMock).toHaveBeenCalledWith(expect.objectContaining({
      collectionName: 'notebook_chunks_3072',
      points: [
        expect.objectContaining({
          vector: new Array<number>(3072).fill(0.5),
        }),
      ],
    }));
  });
});

describe('retrieveNotebookRagContext', () => {
  beforeEach(() => {
    ensureNotebookChunksCollectionMock.mockReset();
    findManyMock.mockReset();
    generateEmbeddingMock.mockReset();
    isRerankingEnabledMock.mockReset();
    rerankDocumentsMock.mockReset();
    searchNotebookChunksMock.mockReset();
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks');
    generateEmbeddingMock.mockResolvedValue(new Array<number>(RAG_VECTOR_DIMENSIONS).fill(0.5));
    isRerankingEnabledMock.mockReturnValue(false);
    process.env.EMBEDDING_MODEL = 'test-embedding-model';
    delete process.env.EMBEDDING_DIMENSIONS;
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
        rerankScore: null,
        score: 0.93,
        vectorScore: 0.93,
      },
    ]);
  });

  it('reranks validated candidates when reranking is enabled', async () => {
    isRerankingEnabledMock.mockReturnValue(true);
    searchNotebookChunksMock.mockResolvedValue([
      {
        payload: {
          notebookId: 'nb-1',
          notebookFileId: 'file-1',
          fileName: 'week-1.txt',
          fileType: 'txt',
          chunkIndex: 0,
          content: 'Lower rerank chunk',
          tokenCount: 3,
          pageNumber: null,
          slideNumber: null,
          timestampStart: null,
          timestampEnd: null,
          embeddingModel: 'test-embedding-model',
        },
        score: 0.99,
      },
      {
        payload: {
          notebookId: 'nb-1',
          notebookFileId: 'file-2',
          fileName: 'week-2.txt',
          fileType: 'txt',
          chunkIndex: 1,
          content: 'Higher rerank chunk',
          tokenCount: 3,
          pageNumber: null,
          slideNumber: null,
          timestampStart: null,
          timestampEnd: null,
          embeddingModel: 'test-embedding-model',
        },
        score: 0.88,
      },
    ]);
    findManyMock.mockResolvedValue([
      { id: 'file-1', name: 'week-1.txt' },
      { id: 'file-2', name: 'week-2.txt' },
    ]);
    rerankDocumentsMock.mockResolvedValue([0.2, 0.9]);

    const results = await retrieveNotebookRagContext({
      limit: 5,
      notebookId: 'nb-1',
      query: 'dynamic programming',
    });

    expect(searchNotebookChunksMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 50,
    }));
    expect(rerankDocumentsMock).toHaveBeenCalledWith({
      documents: ['Lower rerank chunk', 'Higher rerank chunk'],
      query: 'dynamic programming',
    });
    expect(results).toEqual([
      {
        chunkIndex: 1,
        content: 'Higher rerank chunk',
        fileId: 'file-2',
        fileName: 'week-2.txt',
        rerankScore: 0.9,
        score: 0.9,
        vectorScore: 0.88,
      },
      {
        chunkIndex: 0,
        content: 'Lower rerank chunk',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        rerankScore: 0.2,
        score: 0.2,
        vectorScore: 0.99,
      },
    ]);
  });

  it('falls back to vector scores when reranking fails', async () => {
    isRerankingEnabledMock.mockReturnValue(true);
    searchNotebookChunksMock.mockResolvedValue([
      {
        payload: {
          notebookId: 'nb-1',
          notebookFileId: 'file-1',
          fileName: 'week-1.txt',
          fileType: 'txt',
          chunkIndex: 0,
          content: 'First vector chunk',
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
    findManyMock.mockResolvedValue([{ id: 'file-1', name: 'week-1.txt' }]);
    rerankDocumentsMock.mockRejectedValue(new Error('reranker unavailable'));

    const results = await retrieveNotebookRagContext({
      limit: 5,
      notebookId: 'nb-1',
      query: 'graphs',
    });

    expect(results).toEqual([
      {
        chunkIndex: 0,
        content: 'First vector chunk',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        rerankScore: null,
        score: 0.91,
        vectorScore: 0.91,
      },
    ]);
  });

  it('uses configured embedding dimensions for retrieval', async () => {
    process.env.EMBEDDING_DIMENSIONS = '3072';
    ensureNotebookChunksCollectionMock.mockResolvedValue('notebook_chunks_3072');
    generateEmbeddingMock.mockResolvedValue(new Array<number>(3072).fill(0.5));
    searchNotebookChunksMock.mockResolvedValue([]);
    findManyMock.mockResolvedValue([]);

    await retrieveNotebookRagContext({
      limit: 6,
      notebookId: 'nb-1',
      query: 'greedy algorithms',
    });

    expect(ensureNotebookChunksCollectionMock).toHaveBeenCalledWith(3072);
    expect(searchNotebookChunksMock).toHaveBeenCalledWith(expect.objectContaining({
      collectionName: 'notebook_chunks_3072',
      vector: new Array<number>(3072).fill(0.5),
    }));
  });
});

describe('RAG index cleanup', () => {
  beforeEach(() => {
    deleteNotebookChunkPointsByFileMock.mockReset();
    deleteNotebookChunkPointsByNotebookMock.mockReset();
    deleteNotebookChunkPointsByFileMock.mockResolvedValue(undefined);
    deleteNotebookChunkPointsByNotebookMock.mockResolvedValue(undefined);
    process.env.EMBEDDING_MODEL = 'test-embedding-model';
    process.env.EMBEDDING_DIMENSIONS = '3072';
  });

  it('deletes file and notebook points from the active dimension-specific collection', async () => {
    await deleteNotebookFileRagIndex({
      fileId: 'file-1',
      notebookId: 'nb-1',
    });
    await deleteNotebookRagIndex({
      notebookId: 'nb-1',
    });

    expect(deleteNotebookChunkPointsByFileMock).toHaveBeenCalledWith({
      collectionName: 'notebook_chunks_3072',
      fileId: 'file-1',
      notebookId: 'nb-1',
    });
    expect(deleteNotebookChunkPointsByNotebookMock).toHaveBeenCalledWith({
      collectionName: 'notebook_chunks_3072',
      notebookId: 'nb-1',
    });
  });
});

describe('diversifyRagResults', () => {
  it('limits selected context to three chunks per file by default', () => {
    const results = [
      ragResult('file-a', 0, 0.99),
      ragResult('file-a', 1, 0.98),
      ragResult('file-a', 2, 0.97),
      ragResult('file-a', 3, 0.96),
      ragResult('file-b', 0, 0.95),
      ragResult('file-b', 1, 0.94),
    ];

    const diversified = diversifyRagResults(results);

    expect(diversified).toHaveLength(5);
    expect(diversified.filter((result) => result.fileId === 'file-a')).toHaveLength(3);
    expect(diversified.map((result) => result.chunkIndex)).not.toContain(3);
  });

  it('prefers chunks from different files when scores are close', () => {
    const results = [
      ragResult('file-a', 0, 0.99),
      ragResult('file-a', 1, 0.98),
      ragResult('file-b', 0, 0.975),
      ragResult('file-c', 0, 0.97),
    ];

    const diversified = diversifyRagResults(results, {
      maxChunks: 3,
      maxChunksPerFile: 3,
      preserveTopN: 1,
      scoreTolerance: 0.03,
    });

    expect(diversified.map((result) => result.fileId)).toEqual(['file-a', 'file-b', 'file-c']);
  });

  it('preserves higher-scoring chunks when alternative files are outside tolerance', () => {
    const results = [
      ragResult('file-a', 0, 0.99),
      ragResult('file-a', 1, 0.97),
      ragResult('file-b', 0, 0.90),
    ];

    const diversified = diversifyRagResults(results, {
      maxChunks: 2,
      maxChunksPerFile: 3,
      preserveTopN: 1,
      scoreTolerance: 0.03,
    });

    expect(diversified).toEqual([
      ragResult('file-a', 0, 0.99),
      ragResult('file-a', 1, 0.97),
    ]);
  });

  it('does not let preserved results override the per-file cap', () => {
    const results = [
      ragResult('file-a', 0, 0.99),
      ragResult('file-a', 1, 0.98),
      ragResult('file-a', 2, 0.97),
      ragResult('file-b', 0, 0.96),
    ];

    const diversified = diversifyRagResults(results, {
      maxChunks: 4,
      maxChunksPerFile: 2,
      preserveTopN: 3,
      scoreTolerance: 0.03,
    });

    expect(diversified.filter((result) => result.fileId === 'file-a')).toHaveLength(2);
    expect(diversified.map((result) => result.fileId)).toContain('file-b');
  });

  it('caps the final result count', () => {
    const results = [
      ragResult('file-a', 0, 0.99),
      ragResult('file-b', 0, 0.98),
      ragResult('file-c', 0, 0.97),
    ];

    expect(diversifyRagResults(results, { maxChunks: 2 })).toHaveLength(2);
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
        rerankScore: null,
        score: 0.95,
        vectorScore: 0.95,
      },
    ]);

    expect(context).toContain('[SOURCE 1: week-1.txt, chunk 1, score 0.950, vectorScore 0.950, rerankScore n/a]');
    expect(context).toContain('[Source excerpt truncated]');
    expect(context.length).toBeLessThan(RAG_PROMPT_SOURCE_CHAR_LIMIT + 120);
  });
});
