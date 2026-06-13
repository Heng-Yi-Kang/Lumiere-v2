const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
    notebook: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/video-ingestion-job', () => ({
  enqueueNotebookFileVideoIngestionJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
}));

vi.mock('@/lib/youtube-video-ingestion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/youtube-video-ingestion')>();

  return {
    ...actual,
    probeYoutubeVideoMetadata: vi.fn(),
  };
});

import { enqueueNotebookFileVideoIngestionJob } from '@/lib/video-ingestion-job';
import { probeYoutubeVideoMetadata } from '@/lib/youtube-video-ingestion';
import { POST } from './route';

function buildNotebookFile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-1',
    extractedText: null,
    mimeType: 'video/mp4',
    name: 'Lecture video',
    previewContent: null,
    previewFormat: null,
    siteName: 'YouTube',
    size: 'Pending download',
    sourcePath: null,
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    status: 'processing',
    summary: null,
    summaryError: null,
    summaryGeneratedAt: null,
    summaryStatus: 'idle',
    totalPages: null,
    type: 'video',
    uploadDate: '13 Jun 2026',
    ...overrides,
  };
}

function buildNotebook(files = [buildNotebookFile()]) {
  return {
    id: 'nb-1',
    name: 'Algorithms',
    courseCode: 'CS101',
    color: 'indigo',
    description: 'Notes',
    conceptCount: 4,
    files,
    userId: 'user-1',
  };
}

describe('POST /api/notebooks/[notebookId]/youtube-links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(probeYoutubeVideoMetadata).mockResolvedValue({
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      estimatedSizeBytes: 50_000_000,
      title: 'Lecture video',
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it('creates a processing video material and queues ingestion', async () => {
    prismaMock.notebook.findUnique
      .mockResolvedValueOnce({ id: 'nb-1', userId: 'user-1' })
      .mockResolvedValueOnce(buildNotebook());
    prismaMock.notebookFile.findFirst.mockResolvedValue(null);
    prismaMock.notebook.update.mockResolvedValue(buildNotebook());

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/youtube-links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ?t=42' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(probeYoutubeVideoMetadata).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(prismaMock.notebook.update.mock.calls[0][0].data.files.create).toEqual(
      expect.objectContaining({
        name: 'Lecture video',
        siteName: 'YouTube',
        sourcePath: null,
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        status: 'processing',
        summaryStatus: 'idle',
        type: 'video',
      }),
    );
    expect(enqueueNotebookFileVideoIngestionJob).toHaveBeenCalledWith('video-1');
    expect(payload.notebook.files[0].sourceUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('rejects duplicate canonical videos in the same notebook', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-1' });
    prismaMock.notebookFile.findFirst.mockResolvedValue({ id: 'existing-video' });

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/youtube-links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(409);
    expect(probeYoutubeVideoMetadata).not.toHaveBeenCalled();
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });

  it('rejects non-YouTube URLs', async () => {
    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/youtube-links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/video' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(400);
    expect(probeYoutubeVideoMetadata).not.toHaveBeenCalled();
  });

  it('returns 404 for inaccessible notebooks', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/youtube-links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(404);
  });
});
