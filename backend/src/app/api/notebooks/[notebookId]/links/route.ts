import { getAuthenticatedUser } from '@/lib/auth';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { serializeNotebook } from '@/lib/notebooks';
import { prisma } from '@/lib/prisma';
import { indexNotebookFileForRag } from '@/lib/rag';
import {
  normalizeWebLinkUrl,
  scrapeWebLink,
  WEB_LINK_MIN_RAG_TEXT_CHARS,
  WebLinkScrapeError,
  WebLinkValidationError,
} from '@/lib/web-link-scraper';

export async function OPTIONS() {
  return optionsResponse();
}

function formatUploadDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatLinkSize(wordCount: number, textLength: number) {
  if (wordCount > 0) {
    return `${wordCount.toLocaleString('en-US')} words`;
  }

  return textLength > 0 ? `${textLength.toLocaleString('en-US')} chars` : 'Metadata only';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as { url?: unknown } | null;

  if (!body || typeof body.url !== 'string') {
    return jsonResponse({ error: 'url is required' }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeWebLinkUrl(body.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enter a valid web link.';
    return jsonResponse({ error: message }, { status: 400 });
  }

  logBackendProcess('info', 'web_link.api.create.started', {
    notebookId,
    url: normalizedUrl,
  });

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, userId: true },
  });

  if (!existingNotebook || existingNotebook.userId !== user.id) {
    logBackendProcess('warn', 'web_link.api.create.rejected', {
      notebookId,
      reason: 'notebook_not_found',
      url: normalizedUrl,
    });
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const duplicate = await prisma.notebookFile.findFirst({
    where: {
      notebookId,
      sourceUrl: normalizedUrl,
    },
    select: { id: true },
  });

  if (duplicate) {
    return jsonResponse({ error: 'This web link is already in the notebook.' }, { status: 409 });
  }

  let scraped;
  try {
    scraped = await scrapeWebLink(normalizedUrl);
  } catch (error) {
    const message = error instanceof WebLinkValidationError || error instanceof WebLinkScrapeError
      ? error.message
      : 'Failed to scrape that web page.';
    return jsonResponse({ error: message }, { status: 400 });
  }

  const hasRagText = scraped.text.trim().length >= WEB_LINK_MIN_RAG_TEXT_CHARS;
  const previewContent = scraped.text.trim()
    ? [
        scraped.excerpt ? `${scraped.excerpt}\n` : '',
        scraped.text,
      ].filter(Boolean).join('\n')
    : scraped.excerpt || `No readable article text was extracted from ${scraped.finalUrl}.`;

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: {
      files: {
        create: {
          extractedText: scraped.text || null,
          mimeType: 'text/html',
          name: scraped.title || normalizedUrl,
          previewContent,
          previewFormat: 'text',
          siteName: scraped.siteName || null,
          size: formatLinkSize(scraped.wordCount, scraped.text.length),
          sourceUrl: normalizedUrl,
          status: 'ready',
          summary: null,
          summaryError: null,
          summaryGeneratedAt: null,
          summaryStatus: hasRagText ? 'in-progress' : 'idle',
          totalPages: null,
          type: 'link',
          uploadDate: formatUploadDate(new Date()),
        },
      },
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const createdFile = notebook.files.find((file) => file.sourceUrl === normalizedUrl);

  if (!createdFile) {
    logBackendProcess('error', 'web_link.database.create.failed', {
      notebookId,
      reason: 'created_file_not_found',
      url: normalizedUrl,
    });
    return jsonResponse({ error: 'Failed to persist web link.' }, { status: 500 });
  }

  if (hasRagText) {
    try {
      const indexedChunkCount = await indexNotebookFileForRag({
        extractedText: createdFile.extractedText,
        fileId: createdFile.id,
        fileName: createdFile.name,
        fileType: createdFile.type,
        notebookId,
      });
      logBackendProcess('info', 'web_link.api.create.indexed', {
        elapsedMs: getElapsedMs(requestStartedAt),
        fileId: createdFile.id,
        indexedChunkCount,
        notebookId,
        url: normalizedUrl,
      });
    } catch (error) {
      await prisma.notebookFile.delete({
        where: { id: createdFile.id },
      }).catch(() => undefined);
      logBackendProcess('error', 'web_link.api.create.index_failed', {
        elapsedMs: getElapsedMs(requestStartedAt),
        error: error instanceof Error ? error.message : 'Unknown RAG indexing error',
        fileId: createdFile.id,
        notebookId,
        url: normalizedUrl,
      });
      return jsonResponse({ error: 'Failed to index web link for search.' }, { status: 500 });
    }

    startNotebookFileSummaryJob(createdFile.id);
  } else {
    logBackendProcess('warn', 'web_link.api.create.metadata_only', {
      elapsedMs: getElapsedMs(requestStartedAt),
      extractedTextChars: scraped.text.length,
      fileId: createdFile.id,
      notebookId,
      url: normalizedUrl,
    });
  }

  const refreshedNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  logBackendProcess('info', 'web_link.api.create.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileId: createdFile.id,
    indexed: hasRagText,
    notebookId,
    url: normalizedUrl,
  });

  return jsonResponse(
    {
      notebook: refreshedNotebook ? serializeNotebook(refreshedNotebook) : serializeNotebook(notebook),
    },
    { status: 201 },
  );
}
