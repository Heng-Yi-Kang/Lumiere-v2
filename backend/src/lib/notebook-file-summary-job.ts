import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { generateNotebookFileSummary } from '@/lib/file-summary';
import { prisma } from '@/lib/prisma';

export type NotebookFileSummaryStatus = 'idle' | 'in-progress' | 'done' | 'error';

const PARTIAL_SUMMARY_UPDATE_INTERVAL_MS = 750;
const PARTIAL_SUMMARY_UPDATE_CHAR_DELTA = 80;

function getSummaryErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown summary generation error';
}

function hasUsableSummarySource(text: string | null | undefined) {
  return Boolean(text?.replace(/\s+/g, ' ').trim());
}

export async function generateAndStoreNotebookFileSummary(fileId: string) {
  const startedAt = performance.now();
  const file = await prisma.notebookFile.findUnique({
    where: { id: fileId },
    select: {
      extractedText: true,
      id: true,
      name: true,
      type: true,
    },
  });

  if (!file) {
    logBackendProcess('warn', 'file.summary.job.skipped', {
      fileId,
      reason: 'file_not_found',
    });
    return;
  }

  if (!hasUsableSummarySource(file.extractedText)) {
    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        summary: null,
        summaryError: 'No extracted text is available to summarize.',
        summaryGeneratedAt: null,
        summaryStatus: 'error',
      },
    });
    logBackendProcess('warn', 'file.summary.job.skipped', {
      fileId: file.id,
      fileName: file.name,
      reason: 'empty_extracted_text',
    });
    return;
  }

  await prisma.notebookFile.update({
    where: { id: file.id },
    data: {
      summary: null,
      summaryError: null,
      summaryGeneratedAt: null,
      summaryStatus: 'in-progress',
    },
  });

  let partialSummary = '';
  let lastPersistedSummary = '';
  let lastPersistedAt = 0;

  const persistPartialSummary = async (force = false) => {
    const normalizedPartial = partialSummary.replace(/\s+/g, ' ').trim();
    if (!normalizedPartial || normalizedPartial === lastPersistedSummary) {
      return;
    }

    const now = Date.now();
    const charDelta = normalizedPartial.length - lastPersistedSummary.length;
    if (!force && now - lastPersistedAt < PARTIAL_SUMMARY_UPDATE_INTERVAL_MS && charDelta < PARTIAL_SUMMARY_UPDATE_CHAR_DELTA) {
      return;
    }

    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        summary: normalizedPartial,
        summaryError: null,
        summaryGeneratedAt: null,
        summaryStatus: 'in-progress',
      },
    });

    lastPersistedSummary = normalizedPartial;
    lastPersistedAt = now;
  };

  try {
    const summary = await generateNotebookFileSummary({
      fileName: file.name,
      fileType: file.type,
      onDelta: async (text) => {
        partialSummary += text;
        await persistPartialSummary();
      },
      text: file.extractedText || '',
    });

    if (!summary) {
      throw new Error('Summary provider returned an empty summary.');
    }

    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        summary,
        summaryError: null,
        summaryGeneratedAt: new Date(),
        summaryStatus: 'done',
      },
    });

    logBackendProcess('info', 'file.summary.job.completed', {
      elapsedMs: getElapsedMs(startedAt),
      fileId: file.id,
      fileName: file.name,
      summaryChars: summary.length,
    });
  } catch (error) {
    const errorMessage = getSummaryErrorMessage(error);
    await persistPartialSummary(true);
    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        summaryError: errorMessage,
        summaryGeneratedAt: null,
        summaryStatus: 'error',
      },
    });

    logBackendProcess('warn', 'file.summary.job.failed', {
      elapsedMs: getElapsedMs(startedAt),
      error: errorMessage,
      fileId: file.id,
      fileName: file.name,
    });
  }
}

export function startNotebookFileSummaryJob(fileId: string) {
  setImmediate(() => {
    void generateAndStoreNotebookFileSummary(fileId).catch((error) => {
      logBackendProcess('error', 'file.summary.job.crashed', {
        error: getSummaryErrorMessage(error),
        fileId,
      });
    });
  });
}
