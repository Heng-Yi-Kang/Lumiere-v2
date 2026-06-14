DROP INDEX IF EXISTS "NotebookSavedChatReply_notebookId_key";

CREATE INDEX IF NOT EXISTS "NotebookSavedChatReply_notebookId_idx" ON "NotebookSavedChatReply"("notebookId");
