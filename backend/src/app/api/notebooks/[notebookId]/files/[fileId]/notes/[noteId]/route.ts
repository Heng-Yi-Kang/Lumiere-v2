import { jsonResponse, noContentResponse, optionsResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

function serializeFileNote(note: {
  id: string;
  notebookFileId: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: note.id,
    fileId: note.notebookFileId,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

async function getScopedNote(notebookId: string, fileId: string, noteId: string) {
  return prisma.fileNote.findFirst({
    where: {
      id: noteId,
      notebookFileId: fileId,
      notebookFile: {
        notebookId,
      },
    },
  });
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string; noteId: string }> },
) {
  const { fileId, notebookId, noteId } = await context.params;
  const existingNote = await getScopedNote(notebookId, fileId, noteId);

  if (!existingNote) {
    return jsonResponse({ error: 'note not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; body?: string | null }
    | null;

  const title = body?.title?.trim();
  const noteBody = body?.body?.trim() ?? '';

  if (!title) {
    return jsonResponse({ error: 'title is required' }, { status: 400 });
  }

  const note = await prisma.fileNote.update({
    where: {
      id: existingNote.id,
    },
    data: {
      title,
      body: noteBody,
    },
  });

  return jsonResponse({
    note: serializeFileNote(note),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string; noteId: string }> },
) {
  const { fileId, notebookId, noteId } = await context.params;
  const existingNote = await getScopedNote(notebookId, fileId, noteId);

  if (!existingNote) {
    return jsonResponse({ error: 'note not found' }, { status: 404 });
  }

  await prisma.fileNote.delete({
    where: {
      id: existingNote.id,
    },
  });

  return noContentResponse();
}
