import { deleteNotebookStoredFile } from '@/lib/notebook-files';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const { fileId, notebookId } = await context.params;

  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
    },
    select: {
      id: true,
      mimeType: true,
      name: true,
      previewContent: true,
      previewFormat: true,
      sourceUrl: true,
      summary: true,
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
      sourceUrl: file.sourceUrl ?? undefined,
      summary: file.summary ?? undefined,
      totalPages: file.totalPages ?? undefined,
      type: file.type,
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const { fileId, notebookId } = await context.params;

  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
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

  await deleteNotebookStoredFile([file.sourcePath]);

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
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
