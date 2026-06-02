import { buildNotebookStoredFileUrl, deleteNotebookStoredFile } from '@/lib/notebook-files';
import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { deleteNotebookFileRagIndex } from '@/lib/rag';
import { serializeNotebook } from '@/lib/notebooks';
import { prisma } from '@/lib/prisma';

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
      mimeType: true,
      name: true,
      previewContent: true,
      previewFormat: true,
      sourcePath: true,
      summary: true,
      summaryError: true,
      summaryGeneratedAt: true,
      summaryStatus: true,
      totalPages: true,
      type: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  return jsonResponse({
    preview: {
      id: file.id,
      mimeType: file.mimeType ?? undefined,
      name: file.name,
      previewContent: file.previewContent ?? undefined,
      previewFormat: file.previewFormat ?? undefined,
      sourceUrl: buildNotebookStoredFileUrl(notebookId, file.sourcePath),
      summary: file.summary ?? undefined,
      summaryError: file.summaryError ?? undefined,
      summaryGeneratedAt: file.summaryGeneratedAt?.toISOString(),
      summaryStatus: file.summaryStatus,
      totalPages: file.totalPages ?? undefined,
      type: file.type,
    },
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

  await deleteNotebookStoredFile([file.sourcePath]);

  const notebook = await prisma.notebook.findFirst({
    where: {
      id: notebookId,
      userId: user.id,
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebook: notebook ? serializeNotebook(notebook) : null,
  });
}
