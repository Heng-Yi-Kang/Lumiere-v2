import { buildSessionCookie, createSession, hashPassword, normalizeEmail, serializeAuthUser } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; name?: string; password?: string }
    | null;
  const email = normalizeEmail(body?.email || '');
  const name = body?.name?.trim() || '';
  const password = body?.password || '';

  if (!name) {
    return jsonResponse({ error: 'name is required' }, { status: 400 });
  }
  if (!email || !email.includes('@')) {
    return jsonResponse({ error: 'valid email is required' }, { status: 400 });
  }
  if (password.length < 8) {
    return jsonResponse({ error: 'password must be at least 8 characters' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return jsonResponse({ error: 'email is already registered' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hashPassword(password),
      role: 'USER',
    },
    select: {
      disabled: true,
      email: true,
      id: true,
      name: true,
      role: true,
    },
  });
  const session = await createSession(user.id);

  return jsonResponse(
    { user: serializeAuthUser(user) },
    {
      headers: {
        'Set-Cookie': buildSessionCookie(session.token),
      },
      status: 201,
    },
  );
}
