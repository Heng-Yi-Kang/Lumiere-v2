import type { NotebookSavedChatReply } from '@prisma/client';

type SerializedNotebookSavedChatReply = {
  id: string;
  notebookId: string;
  question: string;
  answer: string;
  fileId?: string;
  fileName?: string;
  scopeType: 'notebook' | 'file';
  citations: unknown[];
  createdAt: string;
  updatedAt: string;
};

export function serializeNotebookSavedChatReply(reply: NotebookSavedChatReply): SerializedNotebookSavedChatReply;
export function serializeNotebookSavedChatReply(reply: null): null;
export function serializeNotebookSavedChatReply(reply: NotebookSavedChatReply | null): SerializedNotebookSavedChatReply | null {
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

export function serializeNotebookSavedChatReplies(replies: NotebookSavedChatReply[]) {
  return replies.map((reply) => serializeNotebookSavedChatReply(reply));
}
