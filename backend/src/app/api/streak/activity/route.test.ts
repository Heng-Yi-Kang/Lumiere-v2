const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: {
    getAuthenticatedUser: vi.fn(),
  },
  prismaMock: {
    studyActivityDay: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock.getAuthenticatedUser,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { POST } from './route';

describe('POST /api/streak/activity', () => {
  beforeEach(() => {
    authMock.getAuthenticatedUser.mockReset();
    prismaMock.studyActivityDay.findMany.mockReset();
    prismaMock.studyActivityDay.upsert.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects unauthenticated requests', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue(null);

    const response = await POST(new Request('http://localhost/api/streak/activity', {
      method: 'POST',
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
    expect(prismaMock.studyActivityDay.upsert).not.toHaveBeenCalled();
  });

  it('records the Malaysia-local activity day and returns the streak', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T16:30:00.000Z'));
    authMock.getAuthenticatedUser.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });
    prismaMock.studyActivityDay.upsert.mockResolvedValue({ id: 'activity-1' });
    prismaMock.studyActivityDay.findMany.mockResolvedValue([
      { localDate: '2026-06-01' },
      { localDate: '2026-06-02' },
    ]);

    const response = await POST(new Request('http://localhost/api/streak/activity', {
      method: 'POST',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prismaMock.studyActivityDay.upsert).toHaveBeenCalledWith({
      where: {
        userId_localDate: {
          localDate: '2026-06-02',
          userId: 'user-1',
        },
      },
      create: {
        localDate: '2026-06-02',
        userId: 'user-1',
      },
      update: {},
    });
    expect(payload.streak.currentStreak).toBe(2);
    expect(payload.streak.bestStreak).toBe(2);
    expect(payload.streak.weeklyProgress[1]).toEqual({ day: 'Tue', active: true });

  });
});
