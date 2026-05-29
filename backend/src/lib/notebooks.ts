import type { Notebook as PrismaNotebook, NotebookFile as PrismaNotebookFile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DEFAULT_NOTEBOOK_SEEDS } from './notebookSeed';

type NotebookWithFiles = PrismaNotebook & {
  files: PrismaNotebookFile[];
};

export function serializeNotebook(notebook: NotebookWithFiles) {
  return {
    id: notebook.id,
    universityId: notebook.universityId,
    name: notebook.name,
    courseCode: notebook.courseCode,
    color: notebook.color,
    description: notebook.description,
    conceptCount: notebook.conceptCount,
    fileCount: notebook.files.length,
    files: notebook.files.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type as 'pdf' | 'video' | 'audio' | 'image' | 'link',
      size: file.size,
      uploadDate: file.uploadDate,
      status: file.status as 'processing' | 'ready',
      summary: file.summary ?? undefined,
      transcript: file.transcript ?? undefined,
      totalPages: file.totalPages ?? undefined,
      sourceUrl: file.sourceUrl ?? undefined,
    })),
  };
}

export async function seedNotebooksIfNeeded() {
  const count = await prisma.notebook.count();

  if (count > 0) {
    return;
  }

  for (const notebookSeed of DEFAULT_NOTEBOOK_SEEDS) {
    await prisma.notebook.create({
      data: {
        id: notebookSeed.id,
        universityId: notebookSeed.universityId,
        name: notebookSeed.name,
        courseCode: notebookSeed.courseCode,
        color: notebookSeed.color,
        description: notebookSeed.description,
        conceptCount: notebookSeed.conceptCount,
        files: {
          create: notebookSeed.files.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: file.uploadDate,
            status: file.status,
            summary: file.summary,
            transcript: file.transcript as never,
            totalPages: file.totalPages,
            sourceUrl: file.sourceUrl,
          })),
        },
      },
    });
  }
}
