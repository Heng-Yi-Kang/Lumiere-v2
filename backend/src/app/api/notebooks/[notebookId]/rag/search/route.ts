import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
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
  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as {
    fileId?: string;
    limit?: number;
    query?: string;
  } | null;

  if (!body?.query?.trim()) {
    logBackendProcess('warn', 'rag.api.search.rejected', {
      notebookId,
      reason: 'missing_query',
    });
    return jsonResponse({ error: 'query is required' }, { status: 400 });
  }

  logBackendProcess('info', 'rag.api.search.started', {
    fileId: body.fileId,
    limit: body.limit,
    notebookId,
    queryChars: body.query.length,
  });

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true },
  });

  if (!notebook) {
    logBackendProcess('warn', 'rag.api.search.rejected', {
      notebookId,
      reason: 'notebook_not_found',
    });
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  let results;
  try {
    results = await retrieveNotebookRagContext({
      fileId: body.fileId,
      limit: body.limit,
      notebookId,
      query: body.query,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.api.search.failed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown RAG search error',
      fileId: body.fileId,
      notebookId,
    });
    throw error;
  }

  logBackendProcess('info', 'rag.api.search.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileId: body.fileId,
    notebookId,
    resultCount: results.length,
  });

  return jsonResponse({
    results,
  });
}
