import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { generateNotebookFileSummary } from '@/lib/file-summary';
import { prisma } from '@/lib/prisma';

export type NotebookFileSummaryStatus = 'idle' | 'in-progress' | 'done' | 'error';

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
      summaryError: null,
      summaryStatus: 'in-progress',
    },
  });

  try {
    const summary = await generateNotebookFileSummary({
      fileName: file.name,
      fileType: file.type,
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
