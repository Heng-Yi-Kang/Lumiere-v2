import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { generateChatCompletion } from '@/lib/openai-chat';
import { prisma } from '@/lib/prisma';
import { diversifyRagResults, formatRagContextForPrompt, retrieveNotebookRagContext, splitIntoChunks } from '@/lib/rag';

const NO_GROUNDED_CONTEXT_MESSAGE = 'No grounded context is available for this request. Upload and index at least one file in this notebook before asking grounded questions.';
const FINAL_CONTEXT_LIMIT = 6;
const NOTEBOOK_CONTEXT_CANDIDATE_LIMIT = 20;

type NotebookFileForChat = {
  extractedText: string | null;
  id: string;
  name: string;
};

function buildExtractedTextFallbackResults(files: NotebookFileForChat[], limit = NOTEBOOK_CONTEXT_CANDIDATE_LIMIT) {
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
  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as {
    fileId?: string;
    question?: string;
  } | null;

  const question = body?.question?.trim();

  if (!question) {
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      notebookId,
      reason: 'missing_question',
    });
    return jsonResponse({ error: 'question is required' }, { status: 400 });
  }

  logBackendProcess('info', 'rag.api.chat.started', {
    fileId: body?.fileId,
    notebookId,
    questionChars: question.length,
  });

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
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      notebookId,
      reason: 'notebook_not_found',
    });
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const scopedFile = body?.fileId
    ? notebook.files.find((file) => file.id === body.fileId)
    : null;

  if (body?.fileId && !scopedFile) {
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      fileId: body.fileId,
      notebookId,
      reason: 'file_not_found_in_notebook',
    });
    return jsonResponse({ error: 'file not found in notebook' }, { status: 404 });
  }

  if (!notebook.files.length) {
    logBackendProcess('info', 'rag.api.chat.no_context', {
      elapsedMs: getElapsedMs(requestStartedAt),
      fileId: scopedFile?.id,
      notebookId: notebook.id,
      reason: 'no_files',
    });
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

  let results;
  try {
    results = await retrieveNotebookRagContext({
      fileId: scopedFile?.id,
      limit: scopedFile ? FINAL_CONTEXT_LIMIT : NOTEBOOK_CONTEXT_CANDIDATE_LIMIT,
      notebookId,
      query: question,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.api.chat.search_failed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown RAG search error',
      fileId: scopedFile?.id,
      notebookId,
    });
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'RAG search failed.' },
      { status: 502 },
    );
  }

  const fallbackResults = results.length
    ? []
    : buildExtractedTextFallbackResults(
        scopedFile ? [scopedFile] : notebook.files,
        scopedFile ? FINAL_CONTEXT_LIMIT : NOTEBOOK_CONTEXT_CANDIDATE_LIMIT,
      );
  const selectedResults = results.length ? results : fallbackResults;
  const groundedResults = scopedFile
    ? selectedResults.slice(0, FINAL_CONTEXT_LIMIT)
    : diversifyRagResults(selectedResults, {
        maxChunks: FINAL_CONTEXT_LIMIT,
        maxChunksPerFile: 3,
        preserveTopN: 1,
        scoreTolerance: 0.03,
      });

  logBackendProcess('info', 'rag.api.chat.context_selected', {
    fallbackResultCount: fallbackResults.length,
    fileId: scopedFile?.id,
    notebookId,
    ragResultCount: results.length,
    resultCount: groundedResults.length,
  });

  if (!groundedResults.length) {
    logBackendProcess('info', 'rag.api.chat.no_context', {
      elapsedMs: getElapsedMs(requestStartedAt),
      fileId: scopedFile?.id,
      notebookId: notebook.id,
      reason: 'no_matching_chunks',
    });
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

  const completionStartedAt = performance.now();
  logBackendProcess('info', 'rag.chat_completion.started', {
    contextChunkCount: groundedResults.length,
    fileId: scopedFile?.id,
    notebookId,
    scopeLabel,
  });

  let answer;
  try {
    answer = await generateChatCompletion({
      context: formatRagContextForPrompt(groundedResults),
      question,
      scopeLabel,
    });
  } catch (error) {
    logBackendProcess('error', 'rag.chat_completion.failed', {
      elapsedMs: getElapsedMs(completionStartedAt),
      error: error instanceof Error ? error.message : 'Unknown chat completion error',
      fileId: scopedFile?.id,
      notebookId,
    });
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Grounded chat generation failed.' },
      { status: 502 },
    );
  }

  logBackendProcess('info', 'rag.chat_completion.completed', {
    answerChars: answer.length,
    elapsedMs: getElapsedMs(completionStartedAt),
    fileId: scopedFile?.id,
    notebookId,
  });

  logBackendProcess('info', 'rag.api.chat.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileId: scopedFile?.id,
    notebookId,
    resultCount: groundedResults.length,
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
