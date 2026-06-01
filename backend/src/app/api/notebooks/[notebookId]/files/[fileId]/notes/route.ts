import { jsonResponse, optionsResponse } from '@/lib/http';
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

async function getNotebookFile(notebookId: string, fileId: string) {
  return prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebookId,
    },
    select: {
      id: true,
    },
  });
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const { fileId, notebookId } = await context.params;
  const file = await getNotebookFile(notebookId, fileId);

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const notes = await prisma.fileNote.findMany({
    where: {
      notebookFileId: file.id,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return jsonResponse({
    notes: notes.map(serializeFileNote),
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileId: string }> },
) {
  const { fileId, notebookId } = await context.params;
  const file = await getNotebookFile(notebookId, fileId);

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { title?: string; body?: string | null }
    | null;

  const title = body?.title?.trim();
  const noteBody = body?.body?.trim() ?? '';

  if (!title) {
    return jsonResponse({ error: 'title is required' }, { status: 400 });
  }

  const note = await prisma.fileNote.create({
    data: {
      notebookFileId: file.id,
      title,
      body: noteBody,
    },
  });

  return jsonResponse(
    {
      note: serializeFileNote(note),
    },
    { status: 201 },
  );
}
