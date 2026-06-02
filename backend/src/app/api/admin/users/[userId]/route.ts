import { getAuthenticatedUser, hasRole } from '@/lib/auth';
import { forbiddenResponse, jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

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

  if (actor.id === userId) {
    return jsonResponse({ error: 'admin cannot disable own account' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { disabled?: boolean } | null;

  if (typeof body?.disabled !== 'boolean') {
    return jsonResponse({ error: 'disabled must be a boolean' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return jsonResponse({ error: 'user not found' }, { status: 404 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { disabled: body.disabled },
    select: {
      createdAt: true,
      disabled: true,
      email: true,
      id: true,
      name: true,
      role: true,
    },
  });

  if (body.disabled) {
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });
  }

  return jsonResponse({
    user: {
      createdAt: updatedUser.createdAt.toISOString(),
      disabled: updatedUser.disabled,
      email: updatedUser.email,
      id: updatedUser.id,
      name: updatedUser.name,
      role: updatedUser.role,
    },
  });
}
