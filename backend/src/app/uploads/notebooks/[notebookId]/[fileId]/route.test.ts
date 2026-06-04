import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { GET } from './route';

describe('GET /uploads/notebooks/[notebookId]/[fileId]', () => {
  const originalUploadRoot = process.env.NOTEBOOK_UPLOAD_ROOT;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-upload-route-test-'));
    process.env.NOTEBOOK_UPLOAD_ROOT = tempDir;
    prismaMock.notebookFile.findFirst.mockReset();
  });

  afterEach(async () => {
    process.env.NOTEBOOK_UPLOAD_ROOT = originalUploadRoot;

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('serves an uploaded file from the configured upload root', async () => {
    const notebookDirectory = path.join(tempDir, 'nb-1');
    const storedPath = path.join(notebookDirectory, 'stored-week-1.txt');
    await mkdir(notebookDirectory, { recursive: true });
    await writeFile(storedPath, 'plain text content', 'utf8');

    prismaMock.notebookFile.findFirst.mockResolvedValue({
      mimeType: 'text/plain',
      name: 'week-1.txt',
    });

    const response = await GET(new Request('http://localhost/uploads/notebooks/nb-1/stored-week-1.txt'), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'stored-week-1.txt' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('plain text content');
    expect(prismaMock.notebookFile.findFirst).toHaveBeenCalledWith({
      where: {
        notebookId: 'nb-1',
        notebook: {
          userId: 'user-1',
        },
        sourcePath: storedPath,
      },
      select: {
        mimeType: true,
        name: true,
      },
    });
  });

  it('supports range requests for media previews', async () => {
    const notebookDirectory = path.join(tempDir, 'nb-1');
    const storedPath = path.join(notebookDirectory, 'clip.mp4');
    await mkdir(notebookDirectory, { recursive: true });
    await writeFile(storedPath, '0123456789', 'utf8');

    prismaMock.notebookFile.findFirst.mockResolvedValue({
      mimeType: 'video/mp4',
      name: 'clip.mp4',
    });

    const response = await GET(new Request('http://localhost/uploads/notebooks/nb-1/clip.mp4', {
      headers: {
        range: 'bytes=2-5',
      },
    }), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'clip.mp4' }),
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.text()).toBe('2345');
  });
});
