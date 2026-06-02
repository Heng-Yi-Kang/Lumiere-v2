import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, noContentResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ goalId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { goalId } = await context.params;
  const existingGoal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      userId: user.id,
    },
  });

  if (!existingGoal) {
    return jsonResponse({ error: 'goal not found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | { completed?: boolean; isPriority?: boolean; text?: string }
    | null;
  const nextText = body?.text === undefined ? existingGoal.text : body.text.trim();

  if (!nextText) {
    return jsonResponse({ error: 'text is required' }, { status: 400 });
  }

  if (body?.isPriority === true) {
    await prisma.goal.updateMany({
      where: { userId: user.id },
      data: { isPriority: false },
    });
  }

  const goal = await prisma.goal.update({
    where: { id: existingGoal.id },
    data: {
      completed: body?.completed ?? existingGoal.completed,
      isPriority: body?.isPriority ?? existingGoal.isPriority,
      text: nextText,
    },
  });

  return jsonResponse({
    goal: serializeGoal(goal),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ goalId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { goalId } = await context.params;
  const existingGoal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      userId: user.id,
    },
  });

  if (!existingGoal) {
    return jsonResponse({ error: 'goal not found' }, { status: 404 });
  }

  await prisma.goal.delete({
    where: { id: existingGoal.id },
  });

  if (existingGoal.isPriority) {
    const nextGoal = await prisma.goal.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    if (nextGoal) {
      await prisma.goal.update({
        where: { id: nextGoal.id },
        data: { isPriority: true },
      });
    }
  }

  return noContentResponse();
}
