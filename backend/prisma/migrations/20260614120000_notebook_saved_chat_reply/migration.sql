CREATE TYPE "SavedChatReplyScopeType" AS ENUM ('NOTEBOOK', 'FILE');

CREATE TABLE "NotebookSavedChatReply" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "fileId" TEXT,
    "fileName" TEXT,
    "scopeType" "SavedChatReplyScopeType" NOT NULL,
    "citations" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookSavedChatReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotebookSavedChatReply_notebookId_key" ON "NotebookSavedChatReply"("notebookId");
CREATE INDEX "NotebookSavedChatReply_scopeType_idx" ON "NotebookSavedChatReply"("scopeType");
CREATE INDEX "NotebookSavedChatReply_fileId_idx" ON "NotebookSavedChatReply"("fileId");

ALTER TABLE "NotebookSavedChatReply"
ADD CONSTRAINT "NotebookSavedChatReply_notebookId_fkey"
FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
