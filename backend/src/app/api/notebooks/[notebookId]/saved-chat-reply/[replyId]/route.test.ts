const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    notebookSavedChatReply: {
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { DELETE } from './route';

function params(replyId = 'saved-1') {
  return {
    params: Promise.resolve({ notebookId: 'nb-1', replyId }),
  };
}

describe('DELETE /api/notebooks/[notebookId]/saved-chat-reply/[replyId]', () => {
  beforeEach(() => {
    authMock.mockReset();
    prismaMock.notebookSavedChatReply.delete.mockReset();
    prismaMock.notebookSavedChatReply.findFirst.mockReset();

    authMock.mockResolvedValue({
      disabled: false,
      email: 'user@example.test',
      id: 'user-1',
      name: 'Test User',
      role: 'USER',
    });
  });

  it('deletes a saved answer scoped to the authenticated notebook owner', async () => {
    prismaMock.notebookSavedChatReply.findFirst.mockResolvedValue({ id: 'saved-1' });
    prismaMock.notebookSavedChatReply.delete.mockResolvedValue({ id: 'saved-1' });

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/saved-chat-reply/saved-1', {
        method: 'DELETE',
      }),
      params(),
    );

    expect(response.status).toBe(204);
    expect(prismaMock.notebookSavedChatReply.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'saved-1',
        notebookId: 'nb-1',
        notebook: {
          userId: 'user-1',
        },
      },
      select: {
        id: true,
      },
    });
    expect(prismaMock.notebookSavedChatReply.delete).toHaveBeenCalledWith({
      where: {
        id: 'saved-1',
      },
    });
  });

  it('returns 404 when the saved answer is outside scope', async () => {
    prismaMock.notebookSavedChatReply.findFirst.mockResolvedValue(null);

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/saved-chat-reply/saved-1', {
        method: 'DELETE',
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('saved answer not found');
    expect(prismaMock.notebookSavedChatReply.delete).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated access', async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request('http://localhost/api/notebooks/nb-1/saved-chat-reply/saved-1', {
        method: 'DELETE',
      }),
      params(),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.notebookSavedChatReply.findFirst).not.toHaveBeenCalled();
  });
});
