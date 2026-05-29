import { prisma } from '@/lib/prisma';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        type?: string;
        size?: string;
        uploadDate?: string;
        status?: string;
        summary?: string | null;
        transcript?: unknown;
        totalPages?: number | null;
        sourceUrl?: string | null;
      }
    | null;

  if (!body?.name?.trim()) {
    return jsonResponse({ error: 'name is required' }, { status: 400 });
  }
  if (!body?.type?.trim()) {
    return jsonResponse({ error: 'type is required' }, { status: 400 });
  }
  if (!body?.size?.trim()) {
    return jsonResponse({ error: 'size is required' }, { status: 400 });
  }
  if (!body?.uploadDate?.trim()) {
    return jsonResponse({ error: 'uploadDate is required' }, { status: 400 });
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
      files: {
        create: {
          name: body.name.trim(),
          type: body.type.trim(),
          size: body.size.trim(),
          uploadDate: body.uploadDate.trim(),
          status: body.status?.trim() || 'ready',
          summary: body.summary?.trim() || null,
          transcript: body.transcript === undefined ? undefined : (body.transcript as never),
          totalPages: body.totalPages ?? null,
          sourceUrl: body.sourceUrl?.trim() || null,
        },
      },
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse(
    {
      notebook: serializeNotebook(notebook),
    },
    { status: 201 },
  );
}
