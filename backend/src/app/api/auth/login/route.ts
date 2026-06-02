import {
  ADMIN_EMAIL,
  buildSessionCookie,
  createSession,
  ensureDefaultAdminUser,
  normalizeEmail,
  serializeAuthUser,
  verifyPassword,
} from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  const email = normalizeEmail(body?.email || '');
  const password = body?.password || '';

  if (!email || !password) {
    return jsonResponse({ error: 'email and password are required' }, { status: 400 });
  }

  if (email === normalizeEmail(ADMIN_EMAIL)) {
    await ensureDefaultAdminUser();
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      disabled: true,
      email: true,
      id: true,
      name: true,
      passwordHash: true,
      role: true,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return jsonResponse({ error: 'invalid credentials' }, { status: 401 });
  }

  if (user.disabled) {
    return jsonResponse({ error: 'account disabled' }, { status: 403 });
  }

  const session = await createSession(user.id);

  return jsonResponse(
    {
      user: serializeAuthUser(user),
    },
    {
      headers: {
        'Set-Cookie': buildSessionCookie(session.token),
      },
    },
  );
}
