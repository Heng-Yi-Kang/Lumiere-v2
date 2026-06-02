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

function buildAdminUserStats(users: ReturnType<typeof serializeAdminUser>[]) {
  return users.reduce(
    (stats, user) => ({
      activeSessions: stats.activeSessions + user.sessionCount,
      activeUsers: stats.activeUsers + (user.disabled ? 0 : 1),
      adminUsers: stats.adminUsers + (user.role === 'ADMIN' ? 1 : 0),
      disabledUsers: stats.disabledUsers + (user.disabled ? 1 : 0),
      regularUsers: stats.regularUsers + (user.role === 'USER' ? 1 : 0),
      totalGoals: stats.totalGoals + user.goalCount,
      totalNotebooks: stats.totalNotebooks + user.notebookCount,
      totalUsers: stats.totalUsers + 1,
    }),
    {
      activeSessions: 0,
      activeUsers: 0,
      adminUsers: 0,
      disabledUsers: 0,
      regularUsers: 0,
      totalGoals: 0,
      totalNotebooks: 0,
      totalUsers: 0,
    },
  );
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

  const serializedUsers = users.map(serializeAdminUser);

  return jsonResponse({
    stats: buildAdminUserStats(serializedUsers),
    users: serializedUsers,
  });
}
