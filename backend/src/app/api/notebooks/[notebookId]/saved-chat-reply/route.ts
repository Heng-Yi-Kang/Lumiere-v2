import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, noContentResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeNotebookSavedChatReply } from '@/lib/notebook-saved-chat-replies';
import { prisma } from '@/lib/prisma';

type SavedChatReplyScopeType = 'notebook' | 'file';

type SavedChatReplyBody = {
  answer?: string;
  citations?: unknown;
  fileId?: string | null;
  fileName?: string | null;
  question?: string;
  scopeType?: SavedChatReplyScopeType;
};

export async function OPTIONS() {
  return optionsResponse();
}

async function requireOwnedNotebook(request: Request, notebookId: string) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return { errorResponse: unauthorizedResponse() };
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, userId: true },
  });

  if (!notebook || notebook.userId !== user.id) {
    return { errorResponse: jsonResponse({ error: 'notebook not found' }, { status: 404 }) };
  }

  return { notebook };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const ownership = await requireOwnedNotebook(request, notebookId);

  if (ownership.errorResponse) {
    return ownership.errorResponse;
  }

  const savedChatReply = await prisma.notebookSavedChatReply.findUnique({
    where: { notebookId },
  });

  return jsonResponse({
    savedChatReply: serializeNotebookSavedChatReply(savedChatReply),
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const ownership = await requireOwnedNotebook(request, notebookId);

  if (ownership.errorResponse) {
    return ownership.errorResponse;
  }

  const body = (await request.json().catch(() => null)) as SavedChatReplyBody | null;
  const question = body?.question?.trim();
  const answer = body?.answer?.trim();
  const scopeType = body?.scopeType === 'file' ? 'FILE' : 'NOTEBOOK';
  const fileId = scopeType === 'FILE' ? body?.fileId?.trim() || null : null;
  const fileName = scopeType === 'FILE' ? body?.fileName?.trim() || null : null;
  const citations = Array.isArray(body?.citations) ? body.citations : [];

  if (!question) {
    return jsonResponse({ error: 'question is required' }, { status: 400 });
  }

  if (!answer) {
    return jsonResponse({ error: 'answer is required' }, { status: 400 });
  }

  const savedChatReply = await prisma.notebookSavedChatReply.upsert({
    where: { notebookId },
    create: {
      answer,
      citations,
      fileId,
      fileName,
      notebookId,
      question,
      scopeType,
    },
    update: {
      answer,
      citations,
      fileId,
      fileName,
      question,
      scopeType,
    },
  });

  return jsonResponse({
    savedChatReply: serializeNotebookSavedChatReply(savedChatReply),
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;
  const ownership = await requireOwnedNotebook(request, notebookId);

  if (ownership.errorResponse) {
    return ownership.errorResponse;
  }

  await prisma.notebookSavedChatReply.deleteMany({
    where: { notebookId },
  });

  return noContentResponse();
}
