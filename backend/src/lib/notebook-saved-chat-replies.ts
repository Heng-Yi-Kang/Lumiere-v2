import type { NotebookSavedChatReply } from '@prisma/client';

export function serializeNotebookSavedChatReply(reply: NotebookSavedChatReply | null) {
  if (!reply) {
    return null;
  }

  return {
    id: reply.id,
    notebookId: reply.notebookId,
    question: reply.question,
    answer: reply.answer,
    fileId: reply.fileId ?? undefined,
    fileName: reply.fileName ?? undefined,
    scopeType: reply.scopeType.toLowerCase() as 'notebook' | 'file',
    citations: Array.isArray(reply.citations) ? reply.citations : [],
    createdAt: reply.createdAt.toISOString(),
    updatedAt: reply.updatedAt.toISOString(),
  };
}
