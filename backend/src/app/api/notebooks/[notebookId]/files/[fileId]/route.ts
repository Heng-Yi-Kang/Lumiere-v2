import { buildNotebookStoredFileUrl, deleteNotebookStoredFile } from '@/lib/notebook-files';
import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { deleteNotebookFileRagIndex } from '@/lib/rag';
import { serializeNotebook } from '@/lib/notebooks';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { prisma } from '@/lib/prisma';
import { getNotebookFileHlsDirectory, serializeHlsStatus } from '@/lib/hls-service';

const MAX_NOTEBOOK_FILE_NAME_LENGTH = 120;

export async function OPTIONS() {
  return optionsResponse();
}

async function findNotebookFileForUser(fileId: string, notebookId: string, userId: string) {
  return prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
      notebook: {
        userId,
      },
    },
    select: {
      id: true,
    },
  });
}

async function getSerializedNotebook(notebookId: string, userId: string) {
  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return notebook && (!notebook.userId || notebook.userId === userId) ? serializeNotebook(notebook) : null;
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

  const storedFileUrl = file.sourcePath ? buildNotebookStoredFileUrl(notebookId, file.sourcePath) : undefined;

  return jsonResponse({
    preview: {
      id: file.id,
      ingestionError: file.ingestionError ?? undefined,
      mimeType: file.mimeType ?? undefined,
      name: file.name,
      previewContent: file.previewContent ?? undefined,
      previewFormat: file.previewFormat ?? undefined,
      siteName: file.siteName ?? undefined,
      sourceUrl: file.type === 'video' && storedFileUrl ? storedFileUrl : file.sourceUrl ?? storedFileUrl,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId, notebookId } = await context.params;
  const file = await findNotebookFileForUser(fileId, notebookId, user.id);

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string }
    | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!name) {
    return jsonResponse({ error: 'name is required' }, { status: 400 });
  }

  if (name.length > MAX_NOTEBOOK_FILE_NAME_LENGTH) {
    return jsonResponse({ error: `name must be ${MAX_NOTEBOOK_FILE_NAME_LENGTH} characters or fewer` }, { status: 400 });
  }

  await prisma.notebookFile.update({
    where: { id: file.id },
    data: { name },
  });

  return jsonResponse({
    notebook: await getSerializedNotebook(notebookId, user.id),
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

  return jsonResponse({
    notebook: await getSerializedNotebook(notebookId, user.id),
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

  return jsonResponse({
    notebook: await getSerializedNotebook(notebookId, user.id),
  });
}
