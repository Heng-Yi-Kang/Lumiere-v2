import { getAuthenticatedUser, hasRole } from '@/lib/auth';
import { forbiddenResponse, jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

function serializeAdminUser(user: {
  createdAt: Date;
  disabled: boolean;
  email: string;
  id: string;
  name: string;
  role: string;
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

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }
  if (!hasRole(user, 'ADMIN')) {
    return forbiddenResponse();
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
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

  return jsonResponse({
    users: users.map(serializeAdminUser),
  });
}
