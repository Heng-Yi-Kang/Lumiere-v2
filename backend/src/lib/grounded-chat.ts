import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { prisma } from '@/lib/prisma';
import {
  diversifyRagResults,
  formatRagContextForPrompt,
  retrieveNotebookRagContext,
  splitIntoChunks,
  type RagSearchResult,
} from '@/lib/rag';

export const NO_GROUNDED_CONTEXT_MESSAGE = 'No grounded context is available for this request. Upload and index at least one file in this notebook before asking grounded questions.';

const FINAL_CONTEXT_LIMIT = 6;
const NOTEBOOK_CONTEXT_CANDIDATE_LIMIT = 20;
const CITATION_EXCERPT_MAX_CHARS = 240;

type NotebookFileForChat = {
  extractedText: string | null;
  id: string;
  name: string;
};

type AuthenticatedUserForChat = {
  id: string;
};

function buildExtractedTextFallbackResults(files: NotebookFileForChat[], limit = NOTEBOOK_CONTEXT_CANDIDATE_LIMIT) {
  return files
    .flatMap((file) =>
      splitIntoChunks(file.extractedText || '').map((content, chunkIndex) => ({
        chunkIndex,
        content,
        fileId: file.id,
        fileName: file.name,
        rerankScore: null,
        score: 1,
        vectorScore: 1,
      })),
    )
    .slice(0, limit);
}

function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function buildLocationLabel(result: RagSearchResult) {
  if (typeof result.timestampStart === 'number') {
    const start = formatTimestamp(result.timestampStart);

    if (typeof result.timestampEnd === 'number' && result.timestampEnd > result.timestampStart) {
      return `${start}-${formatTimestamp(result.timestampEnd)}`;
    }

    return start;
  }

  if (typeof result.pageNumber === 'number') {
    return `Page ${result.pageNumber}`;
  }

  if (typeof result.slideNumber === 'number') {
    return `Slide ${result.slideNumber}`;
  }

  return `Chunk ${result.chunkIndex + 1}`;
}

function buildCitationExcerpt(content: string) {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();

  if (normalizedContent.length <= CITATION_EXCERPT_MAX_CHARS) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, CITATION_EXCERPT_MAX_CHARS - 3).trimEnd()}...`;
}

function buildCitation(result: RagSearchResult) {
  const locationLabel = buildLocationLabel(result);

  return {
    chunkIndex: result.chunkIndex,
    excerpt: buildCitationExcerpt(result.content),
    fileId: result.fileId,
    fileName: result.fileName,
    locationLabel,
    position: locationLabel,
    score: result.score,
    type: typeof result.timestampStart === 'number' ? 'timestamp' as const : 'page' as const,
  };
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

export async function prepareGroundedChat(params: {
  fileId?: string;
  notebookId: string;
  question: string;
  requestStartedAt: number;
  user: AuthenticatedUserForChat;
}) {
  const notebook = await prisma.notebook.findUnique({
    where: { id: params.notebookId },
    select: {
      id: true,
      name: true,
      userId: true,
      files: {
        select: {
          extractedText: true,
          id: true,
          name: true,
        },
      },
    },
  });

  if (!notebook || (notebook.userId && notebook.userId !== params.user.id)) {
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      notebookId: params.notebookId,
      reason: 'notebook_not_found',
    });
    return {
      error: { body: { error: 'notebook not found' }, status: 404 },
    };
  }

  const scopedFile = params.fileId
    ? notebook.files.find((file) => file.id === params.fileId)
    : null;

  if (params.fileId && !scopedFile) {
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      fileId: params.fileId,
      notebookId: params.notebookId,
      reason: 'file_not_found_in_notebook',
    });
    return {
      error: { body: { error: 'file not found in notebook' }, status: 404 },
    };
  }

  const scope = {
    fileId: scopedFile?.id,
    fileName: scopedFile?.name,
    notebookId: notebook.id,
    notebookName: notebook.name,
  };

  if (!notebook.files.length) {
    logBackendProcess('info', 'rag.api.chat.no_context', {
      elapsedMs: getElapsedMs(params.requestStartedAt),
      fileId: scopedFile?.id,
      notebookId: notebook.id,
      reason: 'no_files',
    });
    return {
      result: {
        answer: NO_GROUNDED_CONTEXT_MESSAGE,
        citations: [],
        context: '',
        grounded: false,
        scope,
        scopeLabel: '',
      },
    };
  }

  let results: RagSearchResult[] = [];
  let searchFailed = false;
  try {
    results = await retrieveNotebookRagContext({
      fileId: scopedFile?.id,
      limit: scopedFile ? FINAL_CONTEXT_LIMIT : NOTEBOOK_CONTEXT_CANDIDATE_LIMIT,
      notebookId: params.notebookId,
      query: params.question,
    });
  } catch (error) {
    searchFailed = true;
    logBackendProcess('warn', 'rag.api.chat.search_failed', {
      elapsedMs: getElapsedMs(params.requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown RAG search error',
      fileId: scopedFile?.id,
      notebookId: params.notebookId,
    });
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
    notebookId: params.notebookId,
    ragResultCount: results.length,
    resultCount: groundedResults.length,
    searchFailed,
  });

  if (!groundedResults.length) {
    logBackendProcess('info', 'rag.api.chat.no_context', {
      elapsedMs: getElapsedMs(params.requestStartedAt),
      fileId: scopedFile?.id,
      notebookId: notebook.id,
      reason: 'no_matching_chunks',
    });
    return {
      result: {
        answer: NO_GROUNDED_CONTEXT_MESSAGE,
        citations: [],
        context: '',
        grounded: false,
        scope,
        scopeLabel: '',
      },
    };
  }

  return {
    result: {
      answer: '',
      citations: groundedResults.map(buildCitation),
      context: formatRagContextForPrompt(groundedResults),
      grounded: true,
      scope,
      scopeLabel: buildScopeLabel({
        isFallbackContext: !results.length && fallbackResults.length > 0,
        notebookName: notebook.name,
        scopedFile,
      }),
    },
  };
}
