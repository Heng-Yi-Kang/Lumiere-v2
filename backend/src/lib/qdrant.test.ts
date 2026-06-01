const { clientMock, QdrantClientMock, UnexpectedResponseErrorMock } = vi.hoisted(() => {
  class UnexpectedResponseError extends Error {}

  return {
    clientMock: {
      createCollection: vi.fn(),
      createPayloadIndex: vi.fn(),
      delete: vi.fn(),
      getCollection: vi.fn(),
      search: vi.fn(),
      upsert: vi.fn(),
    },
    QdrantClientMock: vi.fn(function QdrantClient() {
      return clientMock;
    }),
    UnexpectedResponseErrorMock: UnexpectedResponseError,
  };
});

vi.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: QdrantClientMock,
  QdrantClientUnexpectedResponseError: UnexpectedResponseErrorMock,
}));

async function loadQdrant() {
  vi.resetModules();
  process.env.QDRANT_URL = 'http://localhost:6333';
  process.env.QDRANT_COLLECTION = 'notebook_chunks';
  delete process.env.QDRANT_API_KEY;

  return import('./qdrant');
}

describe('qdrant client wrapper', () => {
  beforeEach(() => {
    QdrantClientMock.mockClear();
    clientMock.createCollection.mockReset();
    clientMock.createPayloadIndex.mockReset();
    clientMock.delete.mockReset();
    clientMock.getCollection.mockReset();
    clientMock.search.mockReset();
    clientMock.upsert.mockReset();
    clientMock.createPayloadIndex.mockResolvedValue({});
  });

  it('creates the notebook chunk collection when it is missing', async () => {
    const qdrant = await loadQdrant();
    clientMock.getCollection.mockRejectedValue(new UnexpectedResponseErrorMock('404 not found'));
    clientMock.createCollection.mockResolvedValue(true);

    await qdrant.ensureNotebookChunksCollection(4096);

    expect(clientMock.createCollection).toHaveBeenCalledWith('notebook_chunks', {
      vectors: {
        distance: 'Cosine',
        size: 4096,
      },
    });
    expect(clientMock.createPayloadIndex).toHaveBeenCalledWith('notebook_chunks', {
      field_name: 'notebookId',
      field_schema: 'keyword',
      wait: true,
    });
    expect(clientMock.createPayloadIndex).toHaveBeenCalledWith('notebook_chunks', {
      field_name: 'notebookFileId',
      field_schema: 'keyword',
      wait: true,
    });
  });

  it('rejects an existing collection with incompatible vector config', async () => {
    const qdrant = await loadQdrant();
    clientMock.getCollection.mockResolvedValue({
      config: {
        params: {
          vectors: {
            distance: 'Dot',
            size: 1536,
          },
        },
      },
    });

    await expect(qdrant.ensureNotebookChunksCollection(4096)).rejects.toThrow(/4096-dimension Cosine/);
  });

  it('upserts points and searches with notebook and file payload filters', async () => {
    const qdrant = await loadQdrant();
    const vector = [0.1, 0.2];

    await qdrant.upsertNotebookChunkPoints({
      collectionName: 'notebook_chunks',
      points: [
        {
          id: 'point-1',
          vector,
          payload: {
            notebookId: 'nb-1',
            notebookFileId: 'file-1',
            fileName: 'week-1.txt',
            fileType: 'txt',
            chunkIndex: 0,
            content: 'Chunk',
            tokenCount: 1,
            pageNumber: null,
            slideNumber: null,
            timestampStart: null,
            timestampEnd: null,
            embeddingModel: 'model',
          },
        },
      ],
    });
    await qdrant.searchNotebookChunks({
      collectionName: 'notebook_chunks',
      fileId: 'file-1',
      limit: 5,
      notebookId: 'nb-1',
      vector,
    });

    expect(clientMock.upsert).toHaveBeenCalledWith('notebook_chunks', {
      points: [
        {
          id: 'point-1',
          vector,
          payload: expect.objectContaining({
            content: 'Chunk',
            notebookFileId: 'file-1',
            notebookId: 'nb-1',
          }),
        },
      ],
      wait: true,
    });
    expect(clientMock.search).toHaveBeenCalledWith('notebook_chunks', {
      filter: {
        must: [
          {
            key: 'notebookId',
            match: { value: 'nb-1' },
          },
          {
            key: 'notebookFileId',
            match: { value: 'file-1' },
          },
        ],
      },
      limit: 5,
      vector,
      with_payload: true,
      with_vector: false,
    });
  });
});
