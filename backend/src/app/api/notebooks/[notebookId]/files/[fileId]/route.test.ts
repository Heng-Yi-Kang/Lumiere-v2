import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    notebook: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/rag', () => ({
  deleteNotebookFileRagIndex: vi.fn(),
}));

vi.mock('@/lib/notebook-file-summary-job', () => ({
  startNotebookFileSummaryJob: vi.fn(),
}));

import { DELETE, GET, POST } from './route';
import { deleteNotebookFileRagIndex } from '@/lib/rag';
import { startNotebookFileSummaryJob } from '@/lib/notebook-file-summary-job';

describe('GET /api/notebooks/[notebookId]/files/[fileId]', () => {
  beforeEach(() => {
    prismaMock.notebookFile.findFirst.mockReset();
  });

  it('returns the stored preview payload for a notebook file', async () => {
    prismaMock.notebookFile.findFirst.mockResolvedValue({
      id: 'file-1',
      mimeType: 'text/plain',
      name: 'week-1.txt',
      previewContent: 'Preview text',
      previewFormat: 'text',
      sourcePath: path.join('uploads', 'notebooks', 'nb-1', 'week-1.txt'),
      summary: 'Summary',
      summaryError: null,
      summaryGeneratedAt: new Date('2026-06-01T00:00:00.000Z'),
      summaryStatus: 'done',
      totalPages: null,
      type: 'txt',
    });

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview.previewContent).toBe('Preview text');
    expect(payload.preview.summary).toBe('Summary');
    expect(payload.preview.summaryStatus).toBe('done');
    expect(payload.preview.type).toBe('txt');
    expect(payload.preview.sourceUrl).toContain('/uploads/notebooks/nb-1/week-1.txt');
  });
});

describe('POST /api/notebooks/[notebookId]/files/[fileId]', () => {
  beforeEach(() => {
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.notebookFile.update.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    vi.mocked(startNotebookFileSummaryJob).mockReset();
  });

  it('marks the file summary in progress and schedules a retry job', async () => {
    prismaMock.notebookFile.findFirst.mockResolvedValue({
      extractedText: 'Text to summarize again.',
      id: 'file-1',
    });
    prismaMock.notebookFile.update.mockResolvedValue({ id: 'file-1' });
    prismaMock.notebook.findUnique.mockResolvedValue({
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      userId: 'user-1',
      files: [
        {
          id: 'file-1',
          name: 'week-1.txt',
          type: 'txt',
          mimeType: 'text/plain',
          size: '1 KB',
          siteName: null,
          sourceUrl: null,
          uploadDate: '2026-06-01',
          status: 'ready',
          summary: null,
          summaryError: null,
          summaryGeneratedAt: null,
          summaryStatus: 'in-progress',
          totalPages: null,
        },
      ],
    });

    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notebook.files[0].summaryStatus).toBe('in-progress');
    expect(prismaMock.notebookFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        summaryError: null,
        summaryGeneratedAt: null,
        summaryStatus: 'in-progress',
      },
    });
    expect(startNotebookFileSummaryJob).toHaveBeenCalledWith('file-1');
  });

  it('rejects retry when the file has no extracted text', async () => {
    prismaMock.notebookFile.findFirst.mockResolvedValue({
      extractedText: '   ',
      id: 'file-1',
    });

    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('No extracted text is available to summarize.');
    expect(startNotebookFileSummaryJob).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/notebooks/[notebookId]/files/[fileId]', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-delete-test-'));
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.notebookFile.delete.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    vi.mocked(deleteNotebookFileRagIndex).mockReset();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('deletes the db row and the stored file, then returns the refreshed notebook', async () => {
    const storedPath = path.join(tempDir, 'week-1.txt');
    await writeFile(storedPath, 'delete me', 'utf8');

    prismaMock.notebookFile.findFirst.mockResolvedValue({
      id: 'file-1',
      sourcePath: storedPath,
    });
    prismaMock.notebookFile.delete.mockResolvedValue({ id: 'file-1' });
    prismaMock.notebook.findUnique.mockResolvedValue({
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      files: [],
    });

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notebook.fileCount).toBe(0);
    expect(prismaMock.notebookFile.delete).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
      },
    });
    expect(deleteNotebookFileRagIndex).toHaveBeenCalledWith({
      fileId: 'file-1',
      notebookId: 'nb-1',
    });

    await expect(access(storedPath)).rejects.toBeDefined();
  });
});
