const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notebookFileIngestionJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/video-processing', () => ({
  processVideoFile: vi.fn(),
}));

vi.mock('@/lib/rag', () => ({
  indexNotebookFileForRag: vi.fn(),
}));

vi.mock('@/lib/notebook-file-summary-job', () => ({
  startNotebookFileSummaryJob: vi.fn(),
}));

import {
  claimNextVideoIngestionJob,
  processVideoIngestionJob,
} from './video-ingestion-job';
import { indexNotebookFileForRag } from '@/lib/rag';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { processVideoFile } from '@/lib/video-processing';

describe('video ingestion jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.notebookFile.update.mockResolvedValue({});
    prismaMock.notebookFileIngestionJob.update.mockResolvedValue({});
    prismaMock.notebookFileIngestionJob.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(indexNotebookFileForRag).mockResolvedValue(2);
  });

  it('processes a video, indexes RAG chunks, marks the file ready, and starts summary generation', async () => {
    const job = {
      attempts: 1,
      id: 'job-1',
      maxAttempts: 3,
      notebookFileId: 'file-1',
    };
    prismaMock.notebookFile.findUnique.mockResolvedValue({
      id: 'file-1',
      name: 'lecture.mp4',
      notebookId: 'nb-1',
      sourcePath: '/uploads/lecture.mp4',
      status: 'processing',
      type: 'video',
    });
    vi.mocked(processVideoFile).mockResolvedValue({
      durationSeconds: 60,
      previewContent: 'Timestamped transcript\n\n[00:00 - 00:30]\nHello',
      ragSegments: [
        {
          content: 'Video segment content',
          metadata: {
            fileName: 'lecture.mp4',
            fileType: 'video',
            frameDescription: 'Slide frame',
            transcript: 'Hello',
            videoTimestampEnd: 30,
            videoTimestampStart: 0,
          },
        },
      ],
      transcript: 'Hello from video',
    });

    await processVideoIngestionJob(job);

    expect(processVideoFile).toHaveBeenCalledWith({
      fileName: 'lecture.mp4',
      filePath: '/uploads/lecture.mp4',
    });
    expect(indexNotebookFileForRag).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedText: 'Hello from video',
        fileId: 'file-1',
        fileName: 'lecture.mp4',
        fileType: 'video',
        notebookId: 'nb-1',
      }),
    );
    expect(prismaMock.notebookFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({
        status: 'ready',
      }),
    });
    expect(prismaMock.notebookFileIngestionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'succeeded',
      }),
    });
    expect(startNotebookFileSummaryJob).toHaveBeenCalledWith('file-1');
  });

  it('marks the file as error after the final failed attempt', async () => {
    const job = {
      attempts: 3,
      id: 'job-1',
      maxAttempts: 3,
      notebookFileId: 'file-1',
    };
    prismaMock.notebookFile.findUnique.mockResolvedValue({
      id: 'file-1',
      name: 'lecture.mp4',
      notebookId: 'nb-1',
      sourcePath: '/uploads/lecture.mp4',
      status: 'processing',
      type: 'video',
    });
    vi.mocked(processVideoFile).mockRejectedValue(new Error('transcription failed'));

    await processVideoIngestionJob(job);

    expect(prismaMock.notebookFileIngestionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        lastError: 'transcription failed',
        status: 'failed',
      }),
    });
    expect(prismaMock.notebookFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({
        ingestionError: 'transcription failed',
        status: 'error',
      }),
    });
    expect(startNotebookFileSummaryJob).not.toHaveBeenCalled();
  });

  it('reclaims stale running jobs before claiming queued work', async () => {
    prismaMock.notebookFileIngestionJob.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prismaMock.notebookFileIngestionJob.findFirst.mockResolvedValue({
      attempts: 0,
      id: 'job-1',
      maxAttempts: 3,
      notebookFileId: 'file-1',
    });
    prismaMock.notebookFileIngestionJob.findUnique.mockResolvedValue({
      attempts: 1,
      id: 'job-1',
      maxAttempts: 3,
      notebookFileId: 'file-1',
    });

    const job = await claimNextVideoIngestionJob();

    expect(job).toEqual({
      attempts: 1,
      id: 'job-1',
      maxAttempts: 3,
      notebookFileId: 'file-1',
    });
    expect(prismaMock.notebookFileIngestionJob.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'running',
      }),
      data: expect.objectContaining({
        status: 'queued',
      }),
    });
  });
});
