import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '@/lib/notebook-files';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebook: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { POST } from './route';

describe('POST /api/notebooks/[notebookId]/files', () => {
  const originalUploadRoot = process.env.NOTEBOOK_UPLOAD_ROOT;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-route-test-'));
    process.env.NOTEBOOK_UPLOAD_ROOT = tempDir;
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebook.update.mockReset();
  });

  afterEach(async () => {
    process.env.NOTEBOOK_UPLOAD_ROOT = originalUploadRoot;
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uploads a supported file and returns the refreshed notebook payload', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });
    prismaMock.notebook.update.mockImplementation(async ({ data }: { data: { files: { create: Record<string, unknown> } } }) => ({
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      files: [
        {
          id: 'file-1',
          name: data.files.create.name,
          type: data.files.create.type,
          mimeType: data.files.create.mimeType,
          size: data.files.create.size,
          uploadDate: data.files.create.uploadDate,
          status: 'ready',
          summary: data.files.create.summary,
          totalPages: data.files.create.totalPages,
        },
      ],
    }));

    const formData = new FormData();
    formData.append('file', new File(['plain text content'], 'week-1.txt', { type: 'text/plain' }));

    const request = new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.notebook.files).toHaveLength(1);
    expect(prismaMock.notebook.update).toHaveBeenCalledTimes(1);

    const storedPath = prismaMock.notebook.update.mock.calls[0][0].data.files.create.sourcePath as string;
    const storedContent = await readFile(storedPath, 'utf8');
    expect(storedContent).toBe('plain text content');
  });

  it('rejects unsupported file types', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });

    const formData = new FormData();
    formData.append('file', new File(['binary'], 'archive.zip', { type: 'application/zip' }));

    const request = new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/supported/i);
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });

  it('rejects oversize uploads', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });

    const oversizedFile = new File(['x'], 'too-large.txt', { type: 'text/plain' });
    Object.defineProperty(oversizedFile, 'size', {
      value: MAX_UPLOAD_BYTES + 1,
      configurable: true,
    });

    const request = {
      formData: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(oversizedFile),
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/100 MB/);
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });
});
