-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conceptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookFile" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "uploadDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "summary" TEXT,
    "transcript" JSONB,
    "totalPages" INTEGER,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notebook_universityId_idx" ON "Notebook"("universityId");

-- CreateIndex
CREATE INDEX "Notebook_courseCode_idx" ON "Notebook"("courseCode");

-- CreateIndex
CREATE INDEX "NotebookFile_notebookId_idx" ON "NotebookFile"("notebookId");

-- AddForeignKey
ALTER TABLE "NotebookFile" ADD CONSTRAINT "NotebookFile_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
