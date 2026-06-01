import { QdrantClient, QdrantClientUnexpectedResponseError, type Schemas } from '@qdrant/js-client-rest';

export class QdrantConfigError extends Error {}

export type NotebookChunkPayload = {
  notebookId: string;
  notebookFileId: string;
  fileName: string;
  fileType: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber: number | null;
  slideNumber: number | null;
  timestampStart: number | null;
  timestampEnd: number | null;
  embeddingModel: string;
};

export type NotebookChunkPoint = {
  id: string;
  vector: number[];
  payload: NotebookChunkPayload;
};

type CollectionVectorParams = {
  distance: string;
  size: number;
};

let qdrantClient: QdrantClient | undefined;
let ensuredCollection: string | undefined;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new QdrantConfigError(`${name} is required for Qdrant RAG storage.`);
  }

  return value;
}

export function getQdrantCollectionName() {
  return getRequiredEnv('QDRANT_COLLECTION');
}

export function getQdrantClient() {
  if (qdrantClient) {
    return qdrantClient;
  }

  const url = getRequiredEnv('QDRANT_URL');
  const apiKey = process.env.QDRANT_API_KEY?.trim();
  qdrantClient = new QdrantClient({
    url,
    ...(apiKey ? { apiKey } : {}),
  });

  return qdrantClient;
}

function isNotFoundError(error: unknown) {
  return error instanceof QdrantClientUnexpectedResponseError
    && (error.message.includes('404') || error.message.toLowerCase().includes('not found'));
}

function getSingleVectorParams(vectors: Schemas['VectorsConfig'] | undefined): CollectionVectorParams | undefined {
  if (!vectors || typeof vectors !== 'object' || Array.isArray(vectors)) {
    return undefined;
  }

  if ('size' in vectors && 'distance' in vectors) {
    return {
      distance: String(vectors.distance),
      size: Number(vectors.size),
    };
  }

  return undefined;
}

async function ensurePayloadIndexes(client: QdrantClient, collectionName: string) {
  await Promise.all([
    client.createPayloadIndex(collectionName, {
      field_name: 'notebookId',
      field_schema: 'keyword',
      wait: true,
    }).catch((error) => {
      if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('already')) {
        throw error;
      }
    }),
    client.createPayloadIndex(collectionName, {
      field_name: 'notebookFileId',
      field_schema: 'keyword',
      wait: true,
    }).catch((error) => {
      if (!String(error instanceof Error ? error.message : error).toLowerCase().includes('already')) {
        throw error;
      }
    }),
  ]);
}

export async function ensureNotebookChunksCollection(vectorSize: number) {
  const collectionName = getQdrantCollectionName();

  if (ensuredCollection === collectionName) {
    return collectionName;
  }

  const client = getQdrantClient();
  let collection;

  try {
    collection = await client.getCollection(collectionName);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await client.createCollection(collectionName, {
      vectors: {
        distance: 'Cosine',
        size: vectorSize,
      },
    });
    await ensurePayloadIndexes(client, collectionName);
    ensuredCollection = collectionName;
    return collectionName;
  }

  const vectorParams = getSingleVectorParams(collection.config.params.vectors);
  if (!vectorParams || vectorParams.size !== vectorSize || vectorParams.distance !== 'Cosine') {
    throw new QdrantConfigError(
      `Qdrant collection ${collectionName} must use a single ${vectorSize}-dimension Cosine vector.`,
    );
  }

  await ensurePayloadIndexes(client, collectionName);
  ensuredCollection = collectionName;
  return collectionName;
}

function buildFilter(params: {
  fileId?: string;
  notebookId: string;
}): Schemas['Filter'] {
  return {
    must: [
      {
        key: 'notebookId',
        match: { value: params.notebookId },
      },
      ...(params.fileId
        ? [{
            key: 'notebookFileId',
            match: { value: params.fileId },
          }]
        : []),
    ],
  };
}

export async function upsertNotebookChunkPoints(params: {
  collectionName: string;
  points: NotebookChunkPoint[];
}) {
  if (!params.points.length) {
    return;
  }

  await getQdrantClient().upsert(params.collectionName, {
    points: params.points.map((point) => ({
      id: point.id,
      payload: point.payload,
      vector: point.vector,
    })),
    wait: true,
  });
}

export async function searchNotebookChunks(params: {
  collectionName: string;
  fileId?: string;
  limit: number;
  notebookId: string;
  vector: number[];
}) {
  return getQdrantClient().search(params.collectionName, {
    filter: buildFilter({
      fileId: params.fileId,
      notebookId: params.notebookId,
    }),
    limit: params.limit,
    vector: params.vector,
    with_payload: true,
    with_vector: false,
  });
}

export async function deleteNotebookChunkPointsByIds(params: {
  collectionName: string;
  pointIds: string[];
}) {
  if (!params.pointIds.length) {
    return;
  }

  await getQdrantClient().delete(params.collectionName, {
    points: params.pointIds,
    wait: true,
  });
}

export async function deleteNotebookChunkPointsByFile(params: {
  collectionName: string;
  fileId: string;
  notebookId: string;
}) {
  await getQdrantClient().delete(params.collectionName, {
    filter: buildFilter({
      fileId: params.fileId,
      notebookId: params.notebookId,
    }),
    wait: true,
  });
}

export async function deleteNotebookChunkPointsByNotebook(params: {
  collectionName: string;
  notebookId: string;
}) {
  await getQdrantClient().delete(params.collectionName, {
    filter: buildFilter({
      notebookId: params.notebookId,
    }),
    wait: true,
  });
}
