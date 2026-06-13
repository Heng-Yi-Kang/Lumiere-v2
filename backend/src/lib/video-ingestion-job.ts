import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { prisma } from '@/lib/prisma';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_STALE_RUNNING_MS = 30 * 60 * 1000;

type IngestionJob = {
  attempts: number;
  id: string;
  maxAttempts: number;
  notebookFileId: string;
};

let workerStarted = false;
let workerActive = false;
let workerTimeout: NodeJS.Timeout | undefined;

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function nextRetryDate() {
  return new Date(Date.now() + getPositiveNumberEnv('VIDEO_INGESTION_RETRY_DELAY_MS', DEFAULT_RETRY_DELAY_MS));
}

function staleRunningCutoffDate() {
  return new Date(Date.now() - getPositiveNumberEnv('VIDEO_INGESTION_STALE_RUNNING_MS', DEFAULT_STALE_RUNNING_MS));
}

export async function enqueueNotebookFileVideoIngestionJob(fileId: string) {
  return prisma.notebookFileIngestionJob.upsert({
    where: { notebookFileId: fileId },
    create: {
      notebookFileId: fileId,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      status: 'queued',
    },
    update: {
      availableAt: new Date(),
      lastError: null,
      lockedAt: null,
      status: 'queued',
    },
  });
}

async function reclaimStaleRunningJobs() {
  const result = await prisma.notebookFileIngestionJob.updateMany({
    where: {
      lockedAt: { lt: staleRunningCutoffDate() },
      status: 'running',
    },
    data: {
      availableAt: new Date(),
      lockedAt: null,
      status: 'queued',
    },
  });

  if (result.count > 0) {
    logBackendProcess('warn', 'file.video_ingestion.reclaimed_stale_jobs', {
      count: result.count,
    });
  }
}

export async function claimNextVideoIngestionJob(): Promise<IngestionJob | null> {
  await reclaimStaleRunningJobs();

  const job = await prisma.notebookFileIngestionJob.findFirst({
    where: {
      availableAt: { lte: new Date() },
      status: 'queued',
    },
    orderBy: [
      { availableAt: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      attempts: true,
      id: true,
      maxAttempts: true,
      notebookFileId: true,
    },
  });

  if (!job) {
    return null;
  }

  const claimed = await prisma.notebookFileIngestionJob.updateMany({
    where: {
      id: job.id,
      status: 'queued',
    },
    data: {
      attempts: { increment: 1 },
      lockedAt: new Date(),
      status: 'running',
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  const lockedJob = await prisma.notebookFileIngestionJob.findUnique({
    where: { id: job.id },
    select: {
      attempts: true,
      id: true,
      maxAttempts: true,
      notebookFileId: true,
    },
  });

  return lockedJob;
}

async function markJobSucceeded(jobId: string) {
  await prisma.notebookFileIngestionJob.update({
    where: { id: jobId },
    data: {
      lastError: null,
      lockedAt: null,
      status: 'succeeded',
    },
  });
}

async function markJobFailed(job: IngestionJob, errorMessage: string) {
  const isFinalAttempt = job.attempts >= job.maxAttempts;

  await prisma.notebookFileIngestionJob.update({
    where: { id: job.id },
    data: {
      availableAt: isFinalAttempt ? new Date() : nextRetryDate(),
      lastError: errorMessage,
      lockedAt: null,
      status: isFinalAttempt ? 'failed' : 'queued',
    },
  });

  if (isFinalAttempt) {
    await prisma.notebookFile.update({
      where: { id: job.notebookFileId },
      data: {
        ingestionError: errorMessage,
        status: 'error',
        summaryError: null,
        summaryStatus: 'idle',
      },
    }).catch(() => undefined);
  }
}

export async function processVideoIngestionJob(job: IngestionJob) {
  const startedAt = performance.now();
  const file = await prisma.notebookFile.findUnique({
    where: { id: job.notebookFileId },
    select: {
      id: true,
      name: true,
      notebookId: true,
      sourcePath: true,
      status: true,
      type: true,
    },
  });

  if (!file || file.type !== 'video' || !file.sourcePath) {
    await markJobSucceeded(job.id);
    logBackendProcess('warn', 'file.video_ingestion.skipped', {
      fileId: job.notebookFileId,
      jobId: job.id,
      reason: !file ? 'file_not_found' : 'not_video_or_missing_source',
    });
    return;
  }

  await prisma.notebookFile.update({
    where: { id: file.id },
    data: {
      ingestionError: null,
      status: 'processing',
      summaryError: null,
      summaryStatus: 'idle',
    },
  });

  try {
    logBackendProcess('info', 'file.video_ingestion.started', {
      attempt: job.attempts,
      fileId: file.id,
      fileName: file.name,
      jobId: job.id,
      notebookId: file.notebookId,
    });

    const [{ processVideoFile }, { indexNotebookFileForRag }] = await Promise.all([
      import('@/lib/video-processing'),
      import('@/lib/rag'),
    ]);
    const result = await processVideoFile({
      fileName: file.name,
      filePath: file.sourcePath,
    });

    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        extractedText: result.transcript,
        ingestionError: null,
        previewContent: result.previewContent,
        previewFormat: 'text',
        summaryError: null,
        summaryStatus: result.transcript.trim() ? 'in-progress' : 'idle',
      },
    });

    const indexedChunkCount = await indexNotebookFileForRag({
      chunks: result.ragSegments,
      extractedText: result.transcript,
      fileId: file.id,
      fileName: file.name,
      fileType: file.type,
      notebookId: file.notebookId,
    });

    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        ingestionError: null,
        status: 'ready',
      },
    });

    await markJobSucceeded(job.id);

    if (result.transcript.trim()) {
      const { startNotebookFileSummaryJob } = await import('@/lib/notebook-file-summary-job');
      startNotebookFileSummaryJob(file.id);
    }

    logBackendProcess('info', 'file.video_ingestion.completed', {
      elapsedMs: getElapsedMs(startedAt),
      fileId: file.id,
      fileName: file.name,
      indexedChunkCount,
      jobId: job.id,
      notebookId: file.notebookId,
    });
  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);
    await markJobFailed(job, errorMessage);
    logBackendProcess('error', 'file.video_ingestion.failed', {
      attempt: job.attempts,
      elapsedMs: getElapsedMs(startedAt),
      error: errorMessage,
      fileId: file.id,
      fileName: file.name,
      finalAttempt: job.attempts >= job.maxAttempts,
      jobId: job.id,
      notebookId: file.notebookId,
    });
  }
}

async function runWorkerTick() {
  if (workerActive) {
    return;
  }

  workerActive = true;
  try {
    const job = await claimNextVideoIngestionJob();
    if (job) {
      await processVideoIngestionJob(job);
    }
  } catch (error) {
    logBackendProcess('error', 'file.video_ingestion.worker_tick_failed', {
      error: sanitizeErrorMessage(error),
    });
  } finally {
    workerActive = false;
  }
}

function scheduleNextWorkerTick() {
  workerTimeout = setTimeout(() => {
    void runWorkerTick().finally(scheduleNextWorkerTick);
  }, getPositiveNumberEnv('VIDEO_INGESTION_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS));
  workerTimeout.unref?.();
}

export function startVideoIngestionWorker() {
  if (workerStarted || process.env.VIDEO_INGESTION_WORKER_DISABLED === 'true') {
    return;
  }

  workerStarted = true;
  logBackendProcess('info', 'file.video_ingestion.worker_started', {});
  void runWorkerTick().finally(scheduleNextWorkerTick);
}

export function stopVideoIngestionWorkerForTests() {
  if (workerTimeout) {
    clearTimeout(workerTimeout);
  }
  workerStarted = false;
  workerActive = false;
  workerTimeout = undefined;
}
