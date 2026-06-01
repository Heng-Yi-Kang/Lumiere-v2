import { useCallback, useEffect, useState } from 'react';
import {
  createFileNote,
  deleteFileNote,
  fetchFileNotes,
  updateFileNote,
} from '../lib/notebooksApi';
import { FileNote } from '../types';

export function useFileNotes(notebookId?: string, activeFileId?: string) {
  const [allNotes, setAllNotes] = useState<Record<string, FileNote[]>>({});
  const [loadedFileIds, setLoadedFileIds] = useState<Record<string, true>>({});
  const [loadingByFileId, setLoadingByFileId] = useState<Record<string, boolean>>({});
  const [mutationByFileId, setMutationByFileId] = useState<Record<string, boolean>>({});
  const [errorByFileId, setErrorByFileId] = useState<Record<string, string>>({});

  useEffect(() => {
    setAllNotes({});
    setLoadedFileIds({});
    setLoadingByFileId({});
    setMutationByFileId({});
    setErrorByFileId({});
  }, [notebookId]);

  const getNotesForFile = useCallback(
    (fileId: string) => allNotes[fileId] || [],
    [allNotes],
  );

  const loadNotesForFile = useCallback(
    async (fileId: string, force = false) => {
      if (!notebookId) {
        return;
      }

      setLoadingByFileId((current) => ({
        ...current,
        [fileId]: true,
      }));
      setErrorByFileId((current) => {
        const next = { ...current };
        delete next[fileId];
        return next;
      });

      try {
        const notes = await fetchFileNotes(notebookId, fileId);
        setAllNotes((current) => ({
          ...current,
          [fileId]: notes,
        }));
        setLoadedFileIds((current) => ({
          ...current,
          [fileId]: true,
        }));
      } catch (error) {
        setErrorByFileId((current) => ({
          ...current,
          [fileId]: error instanceof Error ? error.message : 'Failed to load notes.',
        }));
      } finally {
        setLoadingByFileId((current) => ({
          ...current,
          [fileId]: false,
        }));
      }
    },
    [notebookId],
  );

  useEffect(() => {
    if (!activeFileId) {
      return;
    }

    if (loadedFileIds[activeFileId] || loadingByFileId[activeFileId] || errorByFileId[activeFileId]) {
      return;
    }

    void loadNotesForFile(activeFileId);
  }, [activeFileId, errorByFileId, loadedFileIds, loadingByFileId, loadNotesForFile]);

  const runMutation = useCallback(
    async (fileId: string, action: () => Promise<void>) => {
      if (!notebookId) {
        throw new Error('Notebook context is required to save notes.');
      }

      setMutationByFileId((current) => ({
        ...current,
        [fileId]: true,
      }));
      setErrorByFileId((current) => {
        const next = { ...current };
        delete next[fileId];
        return next;
      });

      try {
        await action();
      } catch (error) {
        setErrorByFileId((current) => ({
          ...current,
          [fileId]: error instanceof Error ? error.message : 'Failed to save notes.',
        }));
        throw error;
      } finally {
        setMutationByFileId((current) => ({
          ...current,
          [fileId]: false,
        }));
      }
    },
    [notebookId],
  );

  const addNote = useCallback(
    async (fileId: string, title: string, body: string) => {
      await runMutation(fileId, async () => {
        const createdNote = await createFileNote(notebookId!, fileId, {
          title: title.trim() || 'Untitled note',
          body: body.trim(),
        });
        setAllNotes((current) => ({
          ...current,
          [fileId]: [createdNote, ...(current[fileId] || [])],
        }));
        setLoadedFileIds((current) => ({
          ...current,
          [fileId]: true,
        }));
      });
    },
    [notebookId, runMutation],
  );

  const updateNoteForFile = useCallback(
    async (fileId: string, noteId: string, title: string, body: string) => {
      await runMutation(fileId, async () => {
        const updatedNote = await updateFileNote(notebookId!, fileId, noteId, {
          title: title.trim(),
          body: body.trim(),
        });
        setAllNotes((current) => ({
          ...current,
          [fileId]: (current[fileId] || []).map((note) => (note.id === noteId ? updatedNote : note)),
        }));
      });
    },
    [notebookId, runMutation],
  );

  const deleteNoteForFile = useCallback(
    async (fileId: string, noteId: string) => {
      await runMutation(fileId, async () => {
        await deleteFileNote(notebookId!, fileId, noteId);
        setAllNotes((current) => ({
          ...current,
          [fileId]: (current[fileId] || []).filter((note) => note.id !== noteId),
        }));
      });
    },
    [notebookId, runMutation],
  );

  return {
    getNotesForFile,
    isLoadingFile: (fileId: string) => Boolean(loadingByFileId[fileId]),
    isMutatingFile: (fileId: string) => Boolean(mutationByFileId[fileId]),
    getErrorForFile: (fileId: string) => errorByFileId[fileId] || '',
    reloadFileNotes: (fileId: string) => loadNotesForFile(fileId, true),
    addNote,
    updateNote: updateNoteForFile,
    deleteNote: deleteNoteForFile,
  };
}
