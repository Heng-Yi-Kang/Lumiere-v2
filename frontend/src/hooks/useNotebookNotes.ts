import { useCallback, useEffect, useState } from 'react';
import {
  createNotebookNote,
  deleteNotebookNote,
  fetchNotebookNotes,
  updateNotebookNote,
} from '../lib/notebooksApi';
import type { NotebookNote } from '../types';

export function useNotebookNotes(notebookId?: string) {
  const [notes, setNotes] = useState<NotebookNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    if (!notebookId) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextNotes = await fetchNotebookNotes(notebookId);
      setNotes(nextNotes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    setNotes([]);
    setError('');

    if (!notebookId) {
      setIsLoading(false);
      return;
    }

    void loadNotes();
  }, [loadNotes, notebookId]);

  const runMutation = useCallback(
    async (action: () => Promise<void>) => {
      if (!notebookId) {
        throw new Error('Notebook context is required to save notes.');
      }

      setIsMutating(true);
      setError('');

      try {
        await action();
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : 'Failed to save notes.');
        throw mutationError;
      } finally {
        setIsMutating(false);
      }
    },
    [notebookId],
  );

  const addNote = useCallback(
    async (_scopeId: string, title: string, body: string) => {
      await runMutation(async () => {
        const createdNote = await createNotebookNote(notebookId!, {
          title: title.trim() || 'Untitled note',
          body: body.trim(),
        });
        setNotes((currentNotes) => [createdNote, ...currentNotes]);
      });
    },
    [notebookId, runMutation],
  );

  const updateNote = useCallback(
    async (_scopeId: string, noteId: string, title: string, body: string) => {
      await runMutation(async () => {
        const updatedNote = await updateNotebookNote(notebookId!, noteId, {
          title: title.trim(),
          body: body.trim(),
        });
        setNotes((currentNotes) => currentNotes.map((note) => (note.id === noteId ? updatedNote : note)));
      });
    },
    [notebookId, runMutation],
  );

  const deleteNote = useCallback(
    async (_scopeId: string, noteId: string) => {
      await runMutation(async () => {
        await deleteNotebookNote(notebookId!, noteId);
        setNotes((currentNotes) => currentNotes.filter((note) => note.id !== noteId));
      });
    },
    [notebookId, runMutation],
  );

  return {
    addNote,
    deleteNote,
    error,
    isLoading,
    isMutating,
    notes,
    reloadNotes: loadNotes,
    updateNote,
  };
}
