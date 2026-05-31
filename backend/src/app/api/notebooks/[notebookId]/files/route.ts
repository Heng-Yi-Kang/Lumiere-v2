import { prisma } from '@/lib/prisma';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { deleteNotebookStoredFile, NotebookFileValidationError, persistNotebookUpload } from '@/lib/notebook-files';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';
import { indexNotebookFileForRag } from '@/lib/rag';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  logBackendProcess('info', 'file.api.upload.started', {
    notebookId,
  });

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true },
  });

  if (!existingNotebook) {
    logBackendProcess('warn', 'file.api.upload.rejected', {
      notebookId,
      reason: 'notebook_not_found',
    });
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const upload = formData?.get('file');

  if (!(upload instanceof File)) {
    logBackendProcess('warn', 'file.api.upload.rejected', {
      notebookId,
      reason: 'missing_file',
    });
    return jsonResponse({ error: 'file is required' }, { status: 400 });
  }

  let uploadData;
  try {
    uploadData = await persistNotebookUpload(notebookId, upload);
  } catch (error) {
    if (error instanceof NotebookFileValidationError) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    return jsonResponse({ error: 'Failed to process uploaded file.' }, { status: 500 });
  }

  const databaseStartedAt = performance.now();
  logBackendProcess('info', 'file.database.create.started', {
    fileName: uploadData.name,
    fileType: uploadData.type,
    notebookId,
  });

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: {
      files: {
        create: {
          extractedText: uploadData.extractedText || null,
          mimeType: uploadData.mimeType,
          name: uploadData.name,
          previewContent: uploadData.previewContent || null,
          previewFormat: uploadData.previewFormat || null,
          size: uploadData.size,
          sourcePath: uploadData.sourcePath,
          status: 'ready',
          summary: uploadData.summary || null,
          totalPages: uploadData.totalPages ?? null,
          type: uploadData.type,
          uploadDate: uploadData.uploadDate,
        },
      },
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const createdFile = notebook.files.find((file) => file.sourcePath === uploadData.sourcePath);

  if (!createdFile) {
    await deleteNotebookStoredFile([uploadData.sourcePath]);
    logBackendProcess('error', 'file.database.create.failed', {
      fileName: uploadData.name,
      notebookId,
      reason: 'created_file_not_found',
    });
    return jsonResponse({ error: 'Failed to persist uploaded file.' }, { status: 500 });
  }

  logBackendProcess('info', 'file.database.create.completed', {
    elapsedMs: getElapsedMs(databaseStartedAt),
    fileId: createdFile.id,
    fileName: createdFile.name,
    notebookId,
  });

  try {
    const indexedChunkCount = await indexNotebookFileForRag({
      chunks: uploadData.ragChunks,
      extractedText: createdFile.extractedText,
      fileId: createdFile.id,
      fileName: createdFile.name,
      fileType: createdFile.type,
      notebookId,
    });
    logBackendProcess('info', 'file.api.upload.indexed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      fileId: createdFile.id,
      fileName: createdFile.name,
      indexedChunkCount,
      notebookId,
    });
  } catch (error) {
    await prisma.notebookFile.delete({
      where: { id: createdFile.id },
    }).catch(() => undefined);
    await deleteNotebookStoredFile([createdFile.sourcePath]);
    logBackendProcess('error', 'file.api.upload.index_failed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown RAG indexing error',
      fileId: createdFile.id,
      fileName: createdFile.name,
      notebookId,
    });
    return jsonResponse({ error: 'Failed to index uploaded file for search.' }, { status: 500 });
  }

  const refreshedNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  logBackendProcess('info', 'file.api.upload.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileId: createdFile.id,
    fileName: createdFile.name,
    notebookId,
  });

  return jsonResponse(
    {
      notebook: refreshedNotebook ? serializeNotebook(refreshedNotebook) : serializeNotebook(notebook),
    },
    { status: 201 },
  );
}
