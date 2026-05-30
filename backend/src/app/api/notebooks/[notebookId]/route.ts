import { deleteNotebookStoredFile } from '@/lib/notebook-files';
import { jsonResponse, noContentResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        color?: string;
        description?: string;
      }
    | null;

  const name = body?.name?.trim();

  if (!name) {
    return jsonResponse({ error: 'name is required' }, { status: 400 });
  }

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true },
  });

  if (!existingNotebook) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: {
      name,
      color: body?.color?.trim() || 'blue',
      description: body?.description?.trim() || '',
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebook: serializeNotebook(notebook),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        select: {
          sourcePath: true,
        },
      },
    },
  });

  if (!notebook) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  await deleteNotebookStoredFile(notebook.files.map((file) => file.sourcePath));

  await prisma.notebook.delete({
    where: { id: notebookId },
  });

  return noContentResponse();
}
