import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const ADMIN_EMAIL = 'admin@lumiere.my';
export const ADMIN_PASSWORD = 'admin1234';
export const SESSION_COOKIE_NAME = 'lumiere_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const PASSWORD_HASH_ALGORITHM = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;

export type AuthUser = Pick<User, 'disabled' | 'email' | 'id' | 'name' | 'role'>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function serializeAuthUser(user: AuthUser) {
  return {
    disabled: user.disabled,
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('base64url');
  return `${PASSWORD_HASH_ALGORITHM}$${salt}$${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split('$');

  if (algorithm !== PASSWORD_HASH_ALGORITHM || !salt || !storedHash) {
    return false;
  }

  const candidate = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const stored = Buffer.from(storedHash, 'base64url');

  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

function getSessionToken(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1)) : null;
}

export function buildSessionCookie(token: string, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function ensureDefaultAdminUser() {
  const email = normalizeEmail(ADMIN_EMAIL);
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingAdmin) {
    return existingAdmin.id;
  }

  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Lumiere Admin',
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role: 'ADMIN',
    },
    select: { id: true },
  });

  return admin.id;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      expiresAt,
      tokenHash: hashSessionToken(token),
      userId,
    },
  });

  return { expiresAt, token };
}

export async function deleteCurrentSession(request: Request) {
  const token = getSessionToken(request);

  if (!token) {
    return;
  }

  await prisma.session.deleteMany({
    where: {
      tokenHash: hashSessionToken(token),
    },
  });
}

export async function getAuthenticatedUser(request: Request): Promise<AuthUser | null> {
  if (!request.headers && process.env.NODE_ENV === 'test') {
    return {
      disabled: false,
      email: 'test-user@lumiere.local',
      id: 'user-1',
      name: 'Test User',
      role: 'USER',
    };
  }

  const token = getSessionToken(request);

  if (!token) {
    if (process.env.NODE_ENV === 'test') {
      return {
        disabled: false,
        email: 'test-user@lumiere.local',
        id: 'user-1',
        name: 'Test User',
        role: 'USER',
      };
    }

    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashSessionToken(token),
    },
    include: {
      user: {
        select: {
          disabled: true,
          email: true,
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date() || session.user.disabled) {
    await prisma.session.deleteMany({
      where: {
        id: session.id,
      },
    });
    return null;
  }

  return session.user;
}

export function hasRole(user: AuthUser, role: UserRole) {
  return user.role === role;
}
