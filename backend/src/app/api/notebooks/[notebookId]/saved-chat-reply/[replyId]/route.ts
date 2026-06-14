import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, noContentResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ notebookId: string; replyId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { notebookId, replyId } = await context.params;
  const savedChatReply = await prisma.notebookSavedChatReply.findFirst({
    where: {
      id: replyId,
      notebookId,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!savedChatReply) {
    return jsonResponse({ error: 'saved answer not found' }, { status: 404 });
  }

  await prisma.notebookSavedChatReply.delete({
    where: {
      id: savedChatReply.id,
    },
  });

  return noContentResponse();
}
