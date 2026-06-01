import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    notebook: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE, GET } from './route';

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

describe('DELETE /api/notebooks/[notebookId]/files/[fileId]', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-delete-test-'));
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.notebookFile.delete.mockReset();
    prismaMock.notebook.findUnique.mockReset();
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

    await expect(access(storedPath)).rejects.toBeDefined();
  });
});
