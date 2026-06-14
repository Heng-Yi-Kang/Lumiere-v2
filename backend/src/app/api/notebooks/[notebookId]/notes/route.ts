import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeNotebookNote, serializeNotebookNotes } from '@/lib/notebook-notes';
import { prisma } from '@/lib/prisma';

async function getOwnedNotebook(request: Request, notebookId: string) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return { errorResponse: unauthorizedResponse() };
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, userId: true },
  });

  if (!notebook || notebook.userId !== user.id) {
    return { errorResponse: jsonResponse({ error: 'notebook not found' }, { status: 404 }) };
  }

  return { notebook };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const ownership = await getOwnedNotebook(request, notebookId);

  if (ownership.errorResponse) {
    return ownership.errorResponse;
  }

  const notes = await prisma.notebookNote.findMany({
    where: { notebookId },
    orderBy: { updatedAt: 'desc' },
  });

  return jsonResponse({
    notes: serializeNotebookNotes(notes),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const ownership = await getOwnedNotebook(request, notebookId);

  if (ownership.errorResponse) {
    return ownership.errorResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; body?: string | null }
    | null;
  const title = body?.title?.trim();
  const noteBody = body?.body?.trim() ?? '';

  if (!title) {
    return jsonResponse({ error: 'title is required' }, { status: 400 });
  }

  const note = await prisma.notebookNote.create({
    data: {
      notebookId,
      title,
      body: noteBody,
    },
  });

  return jsonResponse(
    {
      note: serializeNotebookNote(note),
    },
    { status: 201 },
  );
}
