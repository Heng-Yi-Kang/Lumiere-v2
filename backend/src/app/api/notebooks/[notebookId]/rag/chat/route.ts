import { jsonResponse, optionsResponse } from '@/lib/http';
import { generateChatCompletion } from '@/lib/openai-chat';
import { prisma } from '@/lib/prisma';
import { formatRagContextForPrompt, retrieveNotebookRagContext } from '@/lib/rag';

const NO_GROUNDED_CONTEXT_MESSAGE = 'No grounded context is available for this request. Upload and index at least one file in this notebook before asking grounded questions.';

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
    question?: string;
  } | null;

  const question = body?.question?.trim();

  if (!question) {
    return jsonResponse({ error: 'question is required' }, { status: 400 });
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: {
      id: true,
      name: true,
      files: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!notebook) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const scopedFile = body?.fileId
    ? notebook.files.find((file) => file.id === body.fileId)
    : null;

  if (body?.fileId && !scopedFile) {
    return jsonResponse({ error: 'file not found in notebook' }, { status: 404 });
  }

  if (!notebook.files.length) {
    return jsonResponse({
      answer: NO_GROUNDED_CONTEXT_MESSAGE,
      citations: [],
      grounded: false,
      scope: {
        fileId: scopedFile?.id,
        fileName: scopedFile?.name,
        notebookId: notebook.id,
        notebookName: notebook.name,
      },
    });
  }

  const results = await retrieveNotebookRagContext({
    fileId: scopedFile?.id,
    limit: 6,
    notebookId,
    query: question,
  });

  if (!results.length) {
    return jsonResponse({
      answer: NO_GROUNDED_CONTEXT_MESSAGE,
      citations: [],
      grounded: false,
      scope: {
        fileId: scopedFile?.id,
        fileName: scopedFile?.name,
        notebookId: notebook.id,
        notebookName: notebook.name,
      },
    });
  }

  const scopeLabel = scopedFile
    ? `file "${scopedFile.name}" in notebook "${notebook.name}"`
    : `all indexed files in notebook "${notebook.name}"`;

  const answer = await generateChatCompletion({
    context: formatRagContextForPrompt(results),
    question,
    scopeLabel,
  });

  return jsonResponse({
    answer,
    citations: results.map((result) => ({
      fileId: result.fileId,
      fileName: result.fileName,
      position: `Chunk ${result.chunkIndex + 1}`,
      score: result.score,
      type: 'page',
    })),
    grounded: true,
    scope: {
      fileId: scopedFile?.id,
      fileName: scopedFile?.name,
      notebookId: notebook.id,
      notebookName: notebook.name,
    },
  });
}
