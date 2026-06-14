import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, noContentResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeNotebookNote } from '@/lib/notebook-notes';
import { prisma } from '@/lib/prisma';

async function getScopedNote(request: Request, notebookId: string, noteId: string) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return { errorResponse: unauthorizedResponse() };
  }

  const note = await prisma.notebookNote.findFirst({
    where: {
      id: noteId,
      notebookId,
      notebook: {
        userId: user.id,
      },
    },
  });

  if (!note) {
    return { errorResponse: jsonResponse({ error: 'note not found' }, { status: 404 }) };
  }

  return { note };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notebookId: string; noteId: string }> },
) {
  const { notebookId, noteId } = await context.params;
  const scoped = await getScopedNote(request, notebookId, noteId);

  if (scoped.errorResponse) {
    return scoped.errorResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; body?: string | null }
    | null;
  const title = body?.title?.trim();
  const noteBody = body?.body?.trim() ?? '';

  if (!title) {
    return jsonResponse({ error: 'title is required' }, { status: 400 });
  }

  const note = await prisma.notebookNote.update({
    where: {
      id: scoped.note.id,
    },
    data: {
      title,
      body: noteBody,
    },
  });

  return jsonResponse({
    note: serializeNotebookNote(note),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ notebookId: string; noteId: string }> },
) {
  const { notebookId, noteId } = await context.params;
  const scoped = await getScopedNote(request, notebookId, noteId);

  if (scoped.errorResponse) {
    return scoped.errorResponse;
  }

  await prisma.notebookNote.delete({
    where: {
      id: scoped.note.id,
    },
  });

  return noContentResponse();
}
