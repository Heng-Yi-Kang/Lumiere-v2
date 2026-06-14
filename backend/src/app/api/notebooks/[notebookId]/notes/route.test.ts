const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    notebook: {
      findUnique: vi.fn(),
    },
    notebookNote: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { GET, POST } from './route';

const notebookNote = {
  id: 'note-1',
  notebookId: 'nb-1',
  title: 'Exam plan',
  body: 'Review chapters 3 and 4.',
  createdAt: new Date('2026-06-14T10:00:00.000Z'),
  updatedAt: new Date('2026-06-14T11:00:00.000Z'),
};

function params(notebookId = 'nb-1') {
  return {
    params: Promise.resolve({ notebookId }),
  };
}

describe('/api/notebooks/[notebookId]/notes', () => {
  beforeEach(() => {
    authMock.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebookNote.create.mockReset();
    prismaMock.notebookNote.findMany.mockReset();

    authMock.mockResolvedValue({
      disabled: false,
      email: 'user@example.test',
      id: 'user-1',
      name: 'Test User',
      role: 'USER',
    });
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-1' });
  });

  it('returns notebook notes for an owned notebook', async () => {
    prismaMock.notebookNote.findMany.mockResolvedValue([notebookNote]);

    const response = await GET(new Request('http://localhost/api/notebooks/nb-1/notes'), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notes).toEqual([
      {
        id: 'note-1',
        notebookId: 'nb-1',
        title: 'Exam plan',
        body: 'Review chapters 3 and 4.',
        createdAt: '2026-06-14T10:00:00.000Z',
        updatedAt: '2026-06-14T11:00:00.000Z',
      },
    ]);
    expect(prismaMock.notebookNote.findMany).toHaveBeenCalledWith({
      where: { notebookId: 'nb-1' },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('creates a notebook note for an owned notebook', async () => {
    prismaMock.notebookNote.create.mockResolvedValue(notebookNote);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: ' Exam plan ',
          body: ' Review chapters 3 and 4. ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.note.title).toBe('Exam plan');
    expect(payload.note.body).toBe('Review chapters 3 and 4.');
    expect(prismaMock.notebookNote.create).toHaveBeenCalledWith({
      data: {
        notebookId: 'nb-1',
        title: 'Exam plan',
        body: 'Review chapters 3 and 4.',
      },
    });
  });

  it('rejects empty titles', async () => {
    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: ' ',
          body: 'Body',
        }),
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('title is required');
    expect(prismaMock.notebookNote.create).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated access', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost/api/notebooks/nb-1/notes'), params());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.notebook.findUnique).not.toHaveBeenCalled();
  });

  it('rejects access to a notebook owned by another user', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-2' });

    const response = await GET(new Request('http://localhost/api/notebooks/nb-1/notes'), params());
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('notebook not found');
    expect(prismaMock.notebookNote.findMany).not.toHaveBeenCalled();
  });
});
