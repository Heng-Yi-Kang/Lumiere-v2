import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

function serializeGoal(goal: {
  completed: boolean;
  id: string;
  isPriority: boolean;
  text: string;
}) {
  return {
    completed: goal.completed,
    id: goal.id,
    isPriority: goal.isPriority,
    text: goal.text,
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

  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  return jsonResponse({
    goals: goals.map(serializeGoal),
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim() || '';

  if (!text) {
    return jsonResponse({ error: 'text is required' }, { status: 400 });
  }

  const hasGoals = await prisma.goal.count({
    where: { userId: user.id },
  });
  const goal = await prisma.goal.create({
    data: {
      isPriority: hasGoals === 0,
      text,
      userId: user.id,
    },
  });

  return jsonResponse(
    {
      goal: serializeGoal(goal),
    },
    { status: 201 },
  );
}
