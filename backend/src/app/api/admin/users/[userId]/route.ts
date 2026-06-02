import { getAuthenticatedUser, hasRole } from '@/lib/auth';
import { forbiddenResponse, jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

type AdminUserPatchBody = {
  disabled?: boolean;
  role?: 'ADMIN' | 'USER';
};

function serializeAdminUser(user: {
  createdAt: Date;
  disabled: boolean;
  email: string;
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
  _count: {
    goals: number;
    notebooks: number;
    sessions: number;
  };
}) {
  return {
    createdAt: user.createdAt.toISOString(),
    disabled: user.disabled,
    email: user.email,
    goalCount: user._count.goals,
    id: user.id,
    name: user.name,
    notebookCount: user._count.notebooks,
    role: user.role,
    sessionCount: user._count.sessions,
  };
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const actor = await getAuthenticatedUser(request);

  if (!actor) {
    return unauthorizedResponse();
  }
  if (!hasRole(actor, 'ADMIN')) {
    return forbiddenResponse();
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as AdminUserPatchBody | null;

  if (!body || (body.disabled === undefined && body.role === undefined)) {
    return jsonResponse({ error: 'disabled or role is required' }, { status: 400 });
  }

  if (body.disabled !== undefined && typeof body.disabled !== 'boolean') {
    return jsonResponse({ error: 'disabled must be a boolean' }, { status: 400 });
  }

  if (body.role !== undefined && body.role !== 'ADMIN' && body.role !== 'USER') {
    return jsonResponse({ error: 'role must be ADMIN or USER' }, { status: 400 });
  }

  if (actor.id === userId && body.disabled === true) {
    return jsonResponse({ error: 'admin cannot disable own account' }, { status: 400 });
  }

  if (actor.id === userId && body.role !== undefined) {
    return jsonResponse({ error: 'admin cannot change own role' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      disabled: true,
      id: true,
      role: true,
    },
  });

  if (!user) {
    return jsonResponse({ error: 'user not found' }, { status: 404 });
  }

  const wouldRemoveActiveAdmin =
    user.role === 'ADMIN'
    && !user.disabled
    && (body.disabled === true || body.role === 'USER');

  if (wouldRemoveActiveAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: {
        disabled: false,
        role: 'ADMIN',
      },
    });

    if (activeAdminCount <= 1) {
      return jsonResponse({ error: 'cannot remove the last active admin' }, { status: 400 });
    }
  }

  const data: AdminUserPatchBody = {};
  if (body.disabled !== undefined) {
    data.disabled = body.disabled;
  }
  if (body.role !== undefined) {
    data.role = body.role;
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data,
    include: {
      _count: {
        select: {
          goals: true,
          notebooks: true,
          sessions: true,
        },
      },
    },
  });

  if (body.disabled === true) {
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
  }

  return jsonResponse({
    user: serializeAdminUser(updatedUser),
  });
}
