import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebook: {
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE, PATCH } from './route';

describe('PATCH /api/notebooks/[notebookId]', () => {
  beforeEach(() => {
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebook.update.mockReset();
  });

  it('updates the notebook title, color, and description', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });
    prismaMock.notebook.update.mockResolvedValue({
      id: 'nb-1',
      name: 'Updated Notebook',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Updated description',
      conceptCount: 4,
      files: [],
    });

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({
          name: ' Updated Notebook ',
          color: ' rose ',
          description: ' Updated description ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      {
        params: Promise.resolve({ notebookId: 'nb-1' }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notebook.name).toBe('Updated Notebook');
    expect(prismaMock.notebook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'nb-1' },
        data: {
          name: 'Updated Notebook',
          color: 'rose',
          description: 'Updated description',
        },
      }),
    );
  });
});

describe('DELETE /api/notebooks/[notebookId]', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-delete-route-test-'));
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebook.delete.mockReset();
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('deletes notebook files from storage and removes the notebook row', async () => {
    const storedPath = path.join(tempDir, 'week-1.txt');
    await writeFile(storedPath, 'delete me', 'utf8');

    prismaMock.notebook.findUnique.mockResolvedValue({
      id: 'nb-1',
      files: [{ sourcePath: storedPath }],
    });
    prismaMock.notebook.delete.mockResolvedValue({ id: 'nb-1' });

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    expect(prismaMock.notebook.delete).toHaveBeenCalledWith({
      where: { id: 'nb-1' },
    });
    await expect(access(storedPath)).rejects.toBeDefined();
  });
});
