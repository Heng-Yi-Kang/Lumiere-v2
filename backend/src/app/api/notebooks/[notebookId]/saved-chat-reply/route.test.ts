const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    notebook: {
      findUnique: vi.fn(),
    },
    notebookSavedChatReply: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE, GET, PUT } from './route';

const savedReply = {
  id: 'saved-1',
  notebookId: 'nb-1',
  question: 'What is entropy?',
  answer: 'Entropy measures uncertainty.',
  fileId: null,
  fileName: null,
  scopeType: 'NOTEBOOK',
  citations: [],
  createdAt: new Date('2026-06-14T10:00:00.000Z'),
  updatedAt: new Date('2026-06-14T10:00:00.000Z'),
};

function request(method = 'GET', body?: unknown) {
  return new Request('http://localhost/api/notebooks/nb-1/saved-chat-reply', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

function params(notebookId = 'nb-1') {
  return {
    params: Promise.resolve({ notebookId }),
  };
}

describe('/api/notebooks/[notebookId]/saved-chat-reply', () => {
  beforeEach(() => {
    authMock.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebookSavedChatReply.deleteMany.mockReset();
    prismaMock.notebookSavedChatReply.findUnique.mockReset();
    prismaMock.notebookSavedChatReply.upsert.mockReset();

    authMock.mockResolvedValue({
      disabled: false,
      email: 'user@example.test',
      id: 'user-1',
      name: 'Test User',
      role: 'USER',
    });
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-1' });
  });

  it('returns null when no saved reply exists', async () => {
    prismaMock.notebookSavedChatReply.findUnique.mockResolvedValue(null);

    const response = await GET(request(), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.savedChatReply).toBeNull();
    expect(prismaMock.notebookSavedChatReply.findUnique).toHaveBeenCalledWith({
      where: { notebookId: 'nb-1' },
    });
  });

  it('upserts a saved reply for an owned notebook', async () => {
    prismaMock.notebookSavedChatReply.upsert.mockResolvedValue({
      ...savedReply,
      citations: [{ fileId: 'file-1', fileName: 'Week 1.pdf', type: 'page', position: 'Page 2' }],
      fileId: 'file-1',
      fileName: 'Week 1.pdf',
      scopeType: 'FILE',
    });

    const response = await PUT(request('PUT', {
      answer: 'The saved answer.',
      citations: [{ fileId: 'file-1', fileName: 'Week 1.pdf', type: 'page', position: 'Page 2' }],
      fileId: 'file-1',
      fileName: 'Week 1.pdf',
      question: ' Explain it ',
      scopeType: 'file',
    }), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.savedChatReply.scopeType).toBe('file');
    expect(payload.savedChatReply.fileName).toBe('Week 1.pdf');
    expect(prismaMock.notebookSavedChatReply.upsert).toHaveBeenCalledWith({
      where: { notebookId: 'nb-1' },
      create: expect.objectContaining({
        answer: 'The saved answer.',
        fileId: 'file-1',
        fileName: 'Week 1.pdf',
        notebookId: 'nb-1',
        question: 'Explain it',
        scopeType: 'FILE',
      }),
      update: expect.objectContaining({
        answer: 'The saved answer.',
        fileId: 'file-1',
        fileName: 'Week 1.pdf',
        question: 'Explain it',
        scopeType: 'FILE',
      }),
    });
  });

  it('overwrites the previous saved reply instead of creating a second slot', async () => {
    prismaMock.notebookSavedChatReply.upsert.mockResolvedValue({
      ...savedReply,
      answer: 'Second answer',
      question: 'Second question',
    });

    await PUT(request('PUT', {
      answer: 'Second answer',
      question: 'Second question',
      scopeType: 'notebook',
    }), params());

    expect(prismaMock.notebookSavedChatReply.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { notebookId: 'nb-1' },
      create: expect.any(Object),
      update: expect.objectContaining({
        answer: 'Second answer',
        question: 'Second question',
      }),
    }));
  });

  it('deletes the saved reply', async () => {
    prismaMock.notebookSavedChatReply.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(request('DELETE'), params());

    expect(response.status).toBe(204);
    expect(prismaMock.notebookSavedChatReply.deleteMany).toHaveBeenCalledWith({
      where: { notebookId: 'nb-1' },
    });
  });

  it('rejects unauthenticated access', async () => {
    authMock.mockResolvedValue(null);

    const response = await GET(request(), params());
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.notebook.findUnique).not.toHaveBeenCalled();
  });

  it('rejects access to non-owned notebooks', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1', userId: 'user-2' });

    const response = await GET(request(), params());
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('notebook not found');
    expect(prismaMock.notebookSavedChatReply.findUnique).not.toHaveBeenCalled();
  });

  it('validates required question and answer', async () => {
    const missingQuestion = await PUT(request('PUT', {
      answer: 'Answer',
      question: ' ',
    }), params());
    const missingAnswer = await PUT(request('PUT', {
      answer: '',
      question: 'Question',
    }), params());

    expect(missingQuestion.status).toBe(400);
    expect((await missingQuestion.json()).error).toBe('question is required');
    expect(missingAnswer.status).toBe(400);
    expect((await missingAnswer.json()).error).toBe('answer is required');
    expect(prismaMock.notebookSavedChatReply.upsert).not.toHaveBeenCalled();
  });
});
