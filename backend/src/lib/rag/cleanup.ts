import { logBackendProcess } from '@/lib/backend-logger';
import {
  deleteNotebookChunkPointsByFile,
  deleteNotebookChunkPointsByNotebook,
  getQdrantCollectionNameForDimensions,
} from '@/lib/qdrant';
import { getRagVectorDimensions } from '@/lib/rag/vector-dimensions';

export async function deleteNotebookFileRagIndex(params: {
  fileId: string;
  notebookId: string;
}) {
  const collectionName = getQdrantCollectionNameForDimensions(getRagVectorDimensions());

  try {
    await deleteNotebookChunkPointsByFile({
      collectionName,
      fileId: params.fileId,
      notebookId: params.notebookId,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.file.cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown Qdrant cleanup error',
      fileId: params.fileId,
      notebookId: params.notebookId,
    });
  }
}

export async function deleteNotebookRagIndex(params: {
  notebookId: string;
}) {
  const collectionName = getQdrantCollectionNameForDimensions(getRagVectorDimensions());

  try {
    await deleteNotebookChunkPointsByNotebook({
      collectionName,
      notebookId: params.notebookId,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.notebook.cleanup_failed', {
      error: error instanceof Error ? error.message : 'Unknown Qdrant cleanup error',
      notebookId: params.notebookId,
    });
  }
}
