-- CreateTable
CREATE TABLE "NotebookNote" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookNote_notebookId_idx" ON "NotebookNote"("notebookId");

-- AddForeignKey
ALTER TABLE "NotebookNote" ADD CONSTRAINT "NotebookNote_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
