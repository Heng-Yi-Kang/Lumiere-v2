import { jsonResponse, optionsResponse } from '@/lib/http';
import { generateChatCompletion } from '@/lib/openai-chat';
import { prisma } from '@/lib/prisma';
import { formatRagContextForPrompt, retrieveNotebookRagContext, splitIntoChunks } from '@/lib/rag';

const NO_GROUNDED_CONTEXT_MESSAGE = 'No grounded context is available for this request. Upload and index at least one file in this notebook before asking grounded questions.';
const FALLBACK_CONTEXT_LIMIT = 6;

type NotebookFileForChat = {
  extractedText: string | null;
  id: string;
  name: string;
};

function buildExtractedTextFallbackResults(files: NotebookFileForChat[], limit = FALLBACK_CONTEXT_LIMIT) {
  return files
    .flatMap((file) =>
      splitIntoChunks(file.extractedText || '').map((content, chunkIndex) => ({
        chunkIndex,
        content,
        fileId: file.id,
        fileName: file.name,
        score: 1,
      })),
    )
    .slice(0, limit);
}

function buildScopeLabel(params: {
  isFallbackContext: boolean;
  notebookName: string;
  scopedFile?: { name: string } | null;
}) {
  if (params.isFallbackContext) {
    return params.scopedFile
      ? `stored extracted text from file "${params.scopedFile.name}" in notebook "${params.notebookName}"`
      : `stored extracted text from notebook "${params.notebookName}"`;
  }

  return params.scopedFile
    ? `file "${params.scopedFile.name}" in notebook "${params.notebookName}"`
    : `all indexed files in notebook "${params.notebookName}"`;
}

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
          extractedText: true,
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

  const fallbackResults = results.length
    ? []
    : buildExtractedTextFallbackResults(scopedFile ? [scopedFile] : notebook.files);
  const groundedResults = results.length ? results : fallbackResults;

  if (!groundedResults.length) {
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

  const scopeLabel = buildScopeLabel({
    isFallbackContext: !results.length && fallbackResults.length > 0,
    notebookName: notebook.name,
    scopedFile,
  });

  const answer = await generateChatCompletion({
    context: formatRagContextForPrompt(groundedResults),
    question,
    scopeLabel,
  });

  return jsonResponse({
    answer,
    citations: groundedResults.map((result) => ({
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
