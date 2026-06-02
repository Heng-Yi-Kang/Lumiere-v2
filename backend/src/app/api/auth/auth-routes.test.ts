const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

import { PATCH as PATCH_ADMIN_USER } from '@/app/api/admin/users/[userId]/route';
import { POST as LOGIN } from '@/app/api/auth/login/route';
import { POST as SIGNUP } from '@/app/api/auth/signup/route';
import { SESSION_COOKIE_NAME, hashPassword } from '@/lib/auth';

describe('authentication routes', () => {
  beforeEach(() => {
    prismaMock.session.create.mockReset();
    prismaMock.session.deleteMany.mockReset();
    prismaMock.session.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.count.mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
  });

  it('creates a user and HTTP-only session cookie on signup', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });
    prismaMock.session.create.mockResolvedValue({ id: 'session-1' });

    const response = await SIGNUP(new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: ' Student@Lumiere.My ',
        name: ' Student One ',
        password: 'password123',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.user.email).toBe('student@lumiere.my');
    expect(response.headers.get('Set-Cookie')).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'student@lumiere.my',
        role: 'USER',
      }),
    }));
  });

  it('rejects invalid login credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      passwordHash: hashPassword('correct-password'),
      role: 'USER',
    });

    const response = await LOGIN(new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'student@lumiere.my',
        password: 'wrong-password',
      }),
      headers: { 'Content-Type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('invalid credentials');
    expect(prismaMock.session.create).not.toHaveBeenCalled();
  });

  it('lets admins disable users and revokes their active sessions', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'admin-session',
      user: {
        disabled: false,
        email: 'admin@lumiere.my',
        id: 'admin-1',
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.user.update.mockResolvedValue({
      _count: {
        goals: 2,
        notebooks: 1,
        sessions: 0,
      },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      disabled: true,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'USER',
    });

    const response = await PATCH_ADMIN_USER(
      new Request('http://localhost/api/admin/users/user-1', {
        method: 'PATCH',
        body: JSON.stringify({ disabled: true }),
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        },
      }),
      { params: Promise.resolve({ userId: 'user-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.disabled).toBe(true);
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('lets admins change another user role without revoking sessions', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'admin-session',
      user: {
        disabled: false,
        email: 'admin@lumiere.my',
        id: 'admin-1',
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      disabled: false,
      id: 'user-1',
      role: 'USER',
    });
    prismaMock.user.update.mockResolvedValue({
      _count: {
        goals: 0,
        notebooks: 0,
        sessions: 1,
      },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      disabled: false,
      email: 'student@lumiere.my',
      id: 'user-1',
      name: 'Student One',
      role: 'ADMIN',
    });

    const response = await PATCH_ADMIN_USER(
      new Request('http://localhost/api/admin/users/user-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'ADMIN' }),
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        },
      }),
      { params: Promise.resolve({ userId: 'user-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.role).toBe('ADMIN');
    expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { role: 'ADMIN' },
    }));
    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects admin attempts to change their own role', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'admin-session',
      user: {
        disabled: false,
        email: 'admin@lumiere.my',
        id: 'admin-1',
        name: 'Admin',
        role: 'ADMIN',
      },
    });

    const response = await PATCH_ADMIN_USER(
      new Request('http://localhost/api/admin/users/admin-1', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'USER' }),
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        },
      }),
      { params: Promise.resolve({ userId: 'admin-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('admin cannot change own role');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('rejects removing the last active admin', async () => {
    prismaMock.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'admin-session',
      user: {
        disabled: false,
        email: 'admin@lumiere.my',
        id: 'admin-1',
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      disabled: false,
      id: 'admin-2',
      role: 'ADMIN',
    });
    prismaMock.user.count.mockResolvedValue(1);

    const response = await PATCH_ADMIN_USER(
      new Request('http://localhost/api/admin/users/admin-2', {
        method: 'PATCH',
        body: JSON.stringify({ role: 'USER' }),
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        },
      }),
      { params: Promise.resolve({ userId: 'admin-2' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('cannot remove the last active admin');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
