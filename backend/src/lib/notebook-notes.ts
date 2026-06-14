import type { NotebookNote } from '@prisma/client';

export function serializeNotebookNote(note: NotebookNote) {
  return {
    id: note.id,
    notebookId: note.notebookId,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function serializeNotebookNotes(notes: NotebookNote[]) {
  return notes.map((note) => serializeNotebookNote(note));
}
