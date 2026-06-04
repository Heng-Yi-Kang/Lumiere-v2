import { buildNotebookStoredFileUrl, deleteNotebookStoredFile } from '@/lib/notebook-files';
import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { deleteNotebookFileRagIndex } from '@/lib/rag';
import { serializeNotebook } from '@/lib/notebooks';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { prisma } from '@/lib/prisma';
import { getNotebookFileHlsDirectory, serializeHlsStatus } from '@/lib/hls-service';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId, notebookId } = await context.params;

  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      id: true,
      ingestionError: true,
      mimeType: true,
      name: true,
      previewContent: true,
      previewFormat: true,
      sourcePath: true,
      sourceUrl: true,
      status: true,
      siteName: true,
      hlsGeneratedAt: true,
      hlsMasterPlaylistUrl: true,
      hlsStatus: true,
      summary: true,
      summaryError: true,
      summaryGeneratedAt: true,
      summaryStatus: true,
      totalPages: true,
      type: true,
      videoDurationSeconds: true,
      videoResolution: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  return jsonResponse({
    preview: {
      id: file.id,
      ingestionError: file.ingestionError ?? undefined,
      mimeType: file.mimeType ?? undefined,
      name: file.name,
      previewContent: file.previewContent ?? undefined,
      previewFormat: file.previewFormat ?? undefined,
      siteName: file.siteName ?? undefined,
      sourceUrl: file.sourceUrl ?? buildNotebookStoredFileUrl(notebookId, file.sourcePath),
      status: file.status,
      summary: file.summary ?? undefined,
      summaryError: file.summaryError ?? undefined,
      summaryGeneratedAt: file.summaryGeneratedAt?.toISOString(),
      summaryStatus: file.summaryStatus,
      ...serializeHlsStatus(file),
      totalPages: file.totalPages ?? undefined,
      type: file.type,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId, notebookId } = await context.params;

  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      extractedText: true,
      id: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  if (!file.extractedText?.replace(/\s+/g, ' ').trim()) {
    return jsonResponse({ error: 'No extracted text is available to summarize.' }, { status: 400 });
  }

  await prisma.notebookFile.update({
    where: { id: file.id },
    data: {
      summaryError: null,
      summaryGeneratedAt: null,
      summaryStatus: 'in-progress',
    },
  });

  startNotebookFileSummaryJob(file.id);

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebook: notebook && (!notebook.userId || notebook.userId === user.id) ? serializeNotebook(notebook) : null,
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId, notebookId } = await context.params;

  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      id: true,
      sourcePath: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  await prisma.notebookFile.delete({
    where: {
      id: file.id,
    },
  });

  await deleteNotebookFileRagIndex({
    fileId: file.id,
    notebookId,
  });

  await deleteNotebookStoredFile([file.sourcePath, getNotebookFileHlsDirectory(notebookId, file.id)]);

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebook: notebook && (!notebook.userId || notebook.userId === user.id) ? serializeNotebook(notebook) : null,
  });
}
