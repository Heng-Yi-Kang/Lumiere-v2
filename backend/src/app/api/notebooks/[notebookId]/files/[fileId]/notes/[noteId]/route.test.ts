const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    fileNote: {
      delete: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE, PATCH } from './route';

describe('PATCH /api/notebooks/[notebookId]/files/[fileId]/notes/[noteId]', () => {
  beforeEach(() => {
    prismaMock.fileNote.findFirst.mockReset();
    prismaMock.fileNote.update.mockReset();
  });

  it('updates a scoped file note', async () => {
    prismaMock.fileNote.findFirst.mockResolvedValue({
      id: 'note-1',
      notebookFileId: 'file-1',
    });
    prismaMock.fileNote.update.mockResolvedValue({
      id: 'note-1',
      notebookFileId: 'file-1',
      title: 'Updated note',
      body: 'Updated body',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T01:00:00.000Z'),
    });

    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        body: JSON.stringify({
          title: ' Updated note ',
          body: ' Updated body ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      {
        params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1', noteId: 'note-1' }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.note.title).toBe('Updated note');
    expect(payload.note.body).toBe('Updated body');
    expect(prismaMock.fileNote.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: {
        title: 'Updated note',
        body: 'Updated body',
      },
    });
  });
});

describe('DELETE /api/notebooks/[notebookId]/files/[fileId]/notes/[noteId]', () => {
  beforeEach(() => {
    prismaMock.fileNote.findFirst.mockReset();
    prismaMock.fileNote.delete.mockReset();
  });

  it('deletes a scoped file note', async () => {
    prismaMock.fileNote.findFirst.mockResolvedValue({
      id: 'note-1',
      notebookFileId: 'file-1',
    });
    prismaMock.fileNote.delete.mockResolvedValue({ id: 'note-1' });

    const response = await DELETE(new Request('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1', noteId: 'note-1' }),
    });

    expect(response.status).toBe(204);
    expect(prismaMock.fileNote.delete).toHaveBeenCalledWith({
      where: {
        id: 'note-1',
      },
    });
  });
});
