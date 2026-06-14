const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    notebookNote: {
      delete: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE, PATCH } from './route';

const notebookNote = {
  id: 'note-1',
  notebookId: 'nb-1',
  title: 'Exam plan',
  body: 'Review chapters 3 and 4.',
  createdAt: new Date('2026-06-14T10:00:00.000Z'),
  updatedAt: new Date('2026-06-14T11:00:00.000Z'),
};

function params(noteId = 'note-1') {
  return {
    params: Promise.resolve({ notebookId: 'nb-1', noteId }),
  };
}

describe('/api/notebooks/[notebookId]/notes/[noteId]', () => {
  beforeEach(() => {
    authMock.mockReset();
    prismaMock.notebookNote.delete.mockReset();
    prismaMock.notebookNote.findFirst.mockReset();
    prismaMock.notebookNote.update.mockReset();

    authMock.mockResolvedValue({
      disabled: false,
      email: 'user@example.test',
      id: 'user-1',
      name: 'Test User',
      role: 'USER',
    });
  });

  it('updates a scoped notebook note', async () => {
    prismaMock.notebookNote.findFirst.mockResolvedValue(notebookNote);
    prismaMock.notebookNote.update.mockResolvedValue({
      ...notebookNote,
      title: 'Updated plan',
      body: 'Updated body',
    });

    const response = await PATCH(
      new Request('http://localhost/api/notebooks/nb-1/notes/note-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: ' Updated plan ',
          body: ' Updated body ',
        }),
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.note.title).toBe('Updated plan');
    expect(payload.note.body).toBe('Updated body');
    expect(prismaMock.notebookNote.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'note-1',
        notebookId: 'nb-1',
        notebook: {
          userId: 'user-1',
        },
      },
    });
    expect(prismaMock.notebookNote.update).toHaveBeenCalledWith({
      where: { id: 'note-1' },
      data: {
        title: 'Updated plan',
        body: 'Updated body',
      },
    });
  });

  it('rejects empty titles on update', async () => {
    prismaMock.notebookNote.findFirst.mockResolvedValue(notebookNote);

    const response = await PATCH(
      new Request('http://localhost/api/notebooks/nb-1/notes/note-1', {
        method: 'PATCH',
        body: JSON.stringify({
          title: '',
          body: 'Body',
        }),
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('title is required');
    expect(prismaMock.notebookNote.update).not.toHaveBeenCalled();
  });

  it('deletes a scoped notebook note', async () => {
    prismaMock.notebookNote.findFirst.mockResolvedValue(notebookNote);
    prismaMock.notebookNote.delete.mockResolvedValue({ id: 'note-1' });

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/notes/note-1', {
        method: 'DELETE',
      }),
      params(),
    );

    expect(response.status).toBe(204);
    expect(prismaMock.notebookNote.delete).toHaveBeenCalledWith({
      where: { id: 'note-1' },
    });
  });

  it('returns 404 when the note is outside the authenticated notebook scope', async () => {
    prismaMock.notebookNote.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/notes/note-1', {
        method: 'DELETE',
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('note not found');
    expect(prismaMock.notebookNote.delete).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated access', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/notes/note-1', {
        method: 'DELETE',
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.notebookNote.findFirst).not.toHaveBeenCalled();
  });
});
