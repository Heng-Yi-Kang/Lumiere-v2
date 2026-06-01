import type { Notebook as PrismaNotebook, NotebookFile as PrismaNotebookFile } from '@prisma/client';

type NotebookWithFiles = PrismaNotebook & {
  files: PrismaNotebookFile[];
};

export function serializeNotebook(notebook: NotebookWithFiles) {
  return {
    id: notebook.id,
    name: notebook.name,
    courseCode: notebook.courseCode,
    color: notebook.color,
    description: notebook.description,
    conceptCount: notebook.conceptCount,
    fileCount: notebook.files.length,
    files: notebook.files.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type as 'pdf' | 'docx' | 'pptx' | 'txt' | 'audio' | 'video',
      mimeType: file.mimeType,
      size: file.size,
      uploadDate: file.uploadDate,
      status: file.status as 'processing' | 'ready',
      summary: file.summary ?? undefined,
      summaryError: file.summaryError ?? undefined,
      summaryGeneratedAt: file.summaryGeneratedAt?.toISOString(),
      summaryStatus: file.summaryStatus as 'idle' | 'in-progress' | 'done' | 'error',
      totalPages: file.totalPages ?? undefined,
    })),
  };
}
