const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: {
    getAuthenticatedUser: vi.fn(),
  },
  prismaMock: {
    goal: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock.getAuthenticatedUser,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { GET, POST } from './route';

describe('/api/goals', () => {
  beforeEach(() => {
    authMock.getAuthenticatedUser.mockReset();
    prismaMock.goal.count.mockReset();
    prismaMock.goal.create.mockReset();
    prismaMock.goal.findMany.mockReset();
  });

  it('rejects unauthenticated goal creation', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ text: 'Finish chapter 2' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });

  it('requires non-empty goal text', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });

    const response = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ text: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('text is required');
    expect(prismaMock.goal.create).not.toHaveBeenCalled();
  });

  it('creates the first goal as the priority goal', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });
    prismaMock.goal.count.mockResolvedValue(0);
    prismaMock.goal.create.mockResolvedValue({
      completed: false,
      id: 'goal-1',
      isPriority: true,
      text: 'Finish chapter 2',
    });

    const response = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ text: ' Finish chapter 2 ' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.goal.create).toHaveBeenCalledWith({
      data: {
        isPriority: true,
        text: 'Finish chapter 2',
        userId: 'user-1',
      },
    });
    expect(payload.goal).toEqual({
      completed: false,
      id: 'goal-1',
      isPriority: true,
      text: 'Finish chapter 2',
    });
  });

  it('creates later goals without changing priority', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });
    prismaMock.goal.count.mockResolvedValue(1);
    prismaMock.goal.create.mockResolvedValue({
      completed: false,
      id: 'goal-2',
      isPriority: false,
      text: 'Review lecture slides',
    });

    const response = await POST(new Request('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ text: 'Review lecture slides' }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.goal.create).toHaveBeenCalledWith({
      data: {
        isPriority: false,
        text: 'Review lecture slides',
        userId: 'user-1',
      },
    });
    expect(payload.goal.isPriority).toBe(false);
  });

  it('loads goals for the authenticated user', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });
    prismaMock.goal.findMany.mockResolvedValue([
      {
        completed: false,
        id: 'goal-1',
        isPriority: true,
        text: 'Finish chapter 2',
      },
    ]);

    const response = await GET(new Request('http://localhost/api/goals'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.goal.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(payload.goals).toHaveLength(1);
  });
});
