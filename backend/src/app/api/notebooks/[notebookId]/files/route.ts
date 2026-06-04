import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import {
  deleteNotebookStoredFile,
  MAX_UPLOAD_BYTES,
  NotebookFileValidationError,
  persistNotebookUpload,
} from '@/lib/notebook-files';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';
import { deleteNotebookFileRagIndex, indexNotebookFileForRag } from '@/lib/rag';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { isFrameDescriptionRateLimitError, RETRY_LATER_UPLOAD_ERROR } from '@/lib/upload-errors';

export async function OPTIONS() {
  return optionsResponse();
}

type NotebookUploadData = Awaited<ReturnType<typeof persistNotebookUpload>>;

async function persistNotebookUploadRecord(
  notebookId: string,
  uploadData: NotebookUploadData,
  requestStartedAt: number,
) {
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
          summary: uploadData.type === 'image' ? uploadData.extractedText || null : null,
          summaryError: null,
          summaryGeneratedAt: uploadData.type === 'image' && uploadData.extractedText?.trim() ? new Date() : null,
          summaryStatus: uploadData.type === 'image' && uploadData.extractedText?.trim()
            ? 'done'
            : uploadData.extractedText?.trim()
              ? 'in-progress'
              : 'idle',
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
    throw new Error('Failed to persist uploaded file.');
  }

  if (!createdFile.sourcePath) {
    await prisma.notebookFile.delete({
      where: { id: createdFile.id },
    }).catch(() => undefined);
    await deleteNotebookStoredFile([uploadData.sourcePath]);
    throw new Error('Failed to persist uploaded file.');
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
    await deleteNotebookFileRagIndex({
      fileId: createdFile.id,
      notebookId,
    });
    await deleteNotebookStoredFile([createdFile.sourcePath]);
    logBackendProcess('error', 'file.api.upload.index_failed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown RAG indexing error',
      fileId: createdFile.id,
      fileName: createdFile.name,
      notebookId,
    });
    throw new Error('Failed to index uploaded file for search.');
  }

  return createdFile;
}

async function rollbackNotebookUploads(notebookId: string, files: Array<{ id: string; sourcePath: string }>) {
  await Promise.all(
    files.map(async (file) => {
      await prisma.notebookFile.delete({
        where: { id: file.id },
      }).catch(() => undefined);
      await deleteNotebookFileRagIndex({
        fileId: file.id,
        notebookId,
      });
      await deleteNotebookStoredFile([file.sourcePath]);
    }),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  logBackendProcess('info', 'file.api.upload.started', {
    notebookId,
  });

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, userId: true },
  });

  if (!existingNotebook || (existingNotebook.userId && existingNotebook.userId !== user.id)) {
    logBackendProcess('warn', 'file.api.upload.rejected', {
      notebookId,
      reason: 'notebook_not_found',
    });
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const uploads = [
    ...(formData?.getAll('file') || []),
    ...(formData?.getAll('files') || []),
  ].filter((upload): upload is File => upload instanceof File);

  if (!uploads.length) {
    logBackendProcess('warn', 'file.api.upload.rejected', {
      notebookId,
      reason: 'missing_file',
    });
    return jsonResponse({ error: 'file is required' }, { status: 400 });
  }

  const totalUploadBytes = uploads.reduce((sum, upload) => sum + upload.size, 0);
  if (totalUploadBytes > MAX_UPLOAD_BYTES) {
    logBackendProcess('warn', 'file.api.upload.rejected', {
      fileCount: uploads.length,
      notebookId,
      reason: 'batch_too_large',
      totalUploadBytes,
    });
    return jsonResponse({ error: 'Selected files exceed the 100 MB upload limit.' }, { status: 400 });
  }

  const createdFiles: Array<{ id: string; sourcePath: string; type: string; extractedText?: string | null }> = [];

  try {
    for (const upload of uploads) {
      const uploadData = await persistNotebookUpload(notebookId, upload);
      const createdFile = await persistNotebookUploadRecord(notebookId, uploadData, requestStartedAt);
      createdFiles.push({
        extractedText: createdFile.extractedText,
        id: createdFile.id,
        sourcePath: createdFile.sourcePath!,
        type: createdFile.type,
      });
    }
  } catch (error) {
    await rollbackNotebookUploads(notebookId, createdFiles);

    if (error instanceof NotebookFileValidationError) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    if (isFrameDescriptionRateLimitError(error)) {
      return jsonResponse({ error: RETRY_LATER_UPLOAD_ERROR }, { status: 429 });
    }

    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to process uploaded file.' },
      { status: 500 },
    );
  }

  for (const createdFile of createdFiles) {
    if (createdFile.type !== 'image' && createdFile.extractedText?.trim()) {
      startNotebookFileSummaryJob(createdFile.id);
    }
  }

  const refreshedNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!refreshedNotebook) {
    throw new Error('Failed to refresh uploaded notebook.');
  }

  logBackendProcess('info', 'file.api.upload.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileCount: createdFiles.length,
    notebookId,
  });

  return jsonResponse(
    {
      notebook: serializeNotebook(refreshedNotebook),
    },
    { status: 201 },
  );
}
