const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findFirst: vi.fn(),
    },
    fileNote: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { GET, POST } from './route';

describe('GET /api/notebooks/[notebookId]/files/[fileId]/notes', () => {
  beforeEach(() => {
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.fileNote.findMany.mockReset();
  });

  it('returns file notes for the scoped notebook file', async () => {
    prismaMock.notebookFile.findFirst.mockResolvedValue({ id: 'file-1' });
    prismaMock.fileNote.findMany.mockResolvedValue([
      {
        id: 'note-1',
        notebookFileId: 'file-1',
        title: 'Exam tips',
        body: 'Focus on chapter 3.',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T01:00:00.000Z'),
      },
    ]);

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.notes).toEqual([
      {
        id: 'note-1',
        fileId: 'file-1',
        title: 'Exam tips',
        body: 'Focus on chapter 3.',
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: '2026-06-01T01:00:00.000Z',
      },
    ]);
  });
});

describe('POST /api/notebooks/[notebookId]/files/[fileId]/notes', () => {
  beforeEach(() => {
    prismaMock.notebookFile.findFirst.mockReset();
    prismaMock.fileNote.create.mockReset();
  });

  it('creates a note for the scoped file', async () => {
    prismaMock.notebookFile.findFirst.mockResolvedValue({ id: 'file-1' });
    prismaMock.fileNote.create.mockResolvedValue({
      id: 'note-1',
      notebookFileId: 'file-1',
      title: 'Exam tips',
      body: 'Focus on chapter 3.',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T01:00:00.000Z'),
    });

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          title: ' Exam tips ',
          body: ' Focus on chapter 3. ',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
      {
        params: Promise.resolve({ notebookId: 'nb-1', fileId: 'file-1' }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.note.title).toBe('Exam tips');
    expect(payload.note.body).toBe('Focus on chapter 3.');
    expect(prismaMock.fileNote.create).toHaveBeenCalledWith({
      data: {
        notebookFileId: 'file-1',
        title: 'Exam tips',
        body: 'Focus on chapter 3.',
      },
    });
  });
});
