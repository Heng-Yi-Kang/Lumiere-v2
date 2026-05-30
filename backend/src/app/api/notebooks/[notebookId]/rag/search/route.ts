import { jsonResponse, optionsResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { retrieveNotebookRagContext } from '@/lib/rag';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as {
    fileId?: string;
    limit?: number;
    query?: string;
  } | null;

  if (!body?.query?.trim()) {
    return jsonResponse({ error: 'query is required' }, { status: 400 });
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true },
  });

  if (!notebook) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const results = await retrieveNotebookRagContext({
    fileId: body.fileId,
    limit: body.limit,
    notebookId,
    query: body.query,
  });

  return jsonResponse({
    results,
  });
}
