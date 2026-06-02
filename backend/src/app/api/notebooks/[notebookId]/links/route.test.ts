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

vi.mock('@/lib/rag', () => ({
  indexNotebookFileForRag: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/lib/notebook-file-summary-job', () => ({
  startNotebookFileSummaryJob: vi.fn(),
}));

vi.mock('@/lib/web-link-scraper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/web-link-scraper')>();

  return {
    ...actual,
    scrapeWebLink: vi.fn(),
  };
});

import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';
import { indexNotebookFileForRag } from '@/lib/rag';
import { scrapeWebLink } from '@/lib/web-link-scraper';
import { POST } from './route';

function buildNotebookFile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    extractedText: 'Readable page text about graphs and algorithms.'.repeat(20),
    mimeType: 'text/html',
    name: 'Graph Algorithms',
    previewContent: 'Readable page text about graphs and algorithms.'.repeat(20),
    previewFormat: 'text',
    siteName: 'Example Notes',
    size: '120 words',
    sourcePath: null,
    sourceUrl: 'https://example.com/article',
    status: 'ready',
    summary: null,
    summaryError: null,
    summaryGeneratedAt: null,
    summaryStatus: 'in-progress',
    totalPages: null,
    type: 'link',
    uploadDate: '2 Jun 2026',
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

describe('POST /api/notebooks/[notebookId]/links', () => {
  beforeEach(() => {
    prismaMock.notebookFile.delete.mockReset();
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebook.update.mockReset();
    vi.mocked(indexNotebookFileForRag).mockResolvedValue(1);
    vi.mocked(indexNotebookFileForRag).mockClear();
    vi.mocked(startNotebookFileSummaryJob).mockReset();
    vi.mocked(scrapeWebLink).mockReset();
  });

  it('scrapes, indexes, schedules summary, and returns the refreshed notebook', async () => {
    vi.mocked(scrapeWebLink).mockResolvedValue({
      excerpt: 'A graph article.',
      finalUrl: 'https://example.com/article',
      siteName: 'Example Notes',
      text: 'Readable page text about graphs and algorithms.'.repeat(20),
      title: 'Graph Algorithms',
      wordCount: 120,
    });
    prismaMock.notebook.findUnique
      .mockResolvedValueOnce({ id: 'nb-1', userId: 'user-1' })
      .mockResolvedValueOnce(buildNotebook());
    prismaMock.notebookFile.findFirst.mockResolvedValue(null);
    prismaMock.notebook.update.mockResolvedValue(buildNotebook());

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/article#section' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(scrapeWebLink).toHaveBeenCalledWith('https://example.com/article');
    expect(prismaMock.notebook.update.mock.calls[0][0].data.files.create).toEqual(
      expect.objectContaining({
        name: 'Graph Algorithms',
        siteName: 'Example Notes',
        sourceUrl: 'https://example.com/article',
        summaryStatus: 'in-progress',
        type: 'link',
      }),
    );
    expect(indexNotebookFileForRag).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'link-1',
        fileType: 'link',
        notebookId: 'nb-1',
      }),
    );
    expect(startNotebookFileSummaryJob).toHaveBeenCalledWith('link-1');
    expect(payload.notebook.files[0].type).toBe('link');
    expect(payload.notebook.files[0].sourceUrl).toBe('https://example.com/article');
  });

  it('rejects duplicate links in the same notebook', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-1' });
    prismaMock.notebookFile.findFirst.mockResolvedValue({ id: 'existing-link' });

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/article' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(409);
    expect(scrapeWebLink).not.toHaveBeenCalled();
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });

  it('creates metadata-only link material without indexing short extracted text', async () => {
    vi.mocked(scrapeWebLink).mockResolvedValue({
      excerpt: 'Short page metadata.',
      finalUrl: 'https://example.com/short',
      siteName: 'Example Notes',
      text: 'Too short.',
      title: 'Short Page',
      wordCount: 2,
    });
    const metadataOnlyFile = buildNotebookFile({
      extractedText: 'Too short.',
      name: 'Short Page',
      previewContent: 'Short page metadata.\n\nToo short.',
      size: '2 words',
      sourceUrl: 'https://example.com/short',
      summaryStatus: 'idle',
    });
    prismaMock.notebook.findUnique
      .mockResolvedValueOnce({ id: 'nb-1', userId: 'user-1' })
      .mockResolvedValueOnce(buildNotebook([metadataOnlyFile]));
    prismaMock.notebookFile.findFirst.mockResolvedValue(null);
    prismaMock.notebook.update.mockResolvedValue(buildNotebook([metadataOnlyFile]));

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/short' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(indexNotebookFileForRag).not.toHaveBeenCalled();
    expect(startNotebookFileSummaryJob).not.toHaveBeenCalled();
    expect(payload.notebook.files[0].summaryStatus).toBe('idle');
  });

  it('rejects non-http links before scraping', async () => {
    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/links', {
      method: 'POST',
      body: JSON.stringify({ url: 'file:///etc/passwd' }),
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(400);
    expect(scrapeWebLink).not.toHaveBeenCalled();
  });
});
