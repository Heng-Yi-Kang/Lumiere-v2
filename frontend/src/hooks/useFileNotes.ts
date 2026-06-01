import { useCallback, useEffect, useState } from 'react';
import { FileNote } from '../types';

const STORAGE_KEY = 'lumiere_file_notes';

function readNotes(): Record<string, FileNote[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FileNote[]>;
    return parsed || {};
  } catch {
    return {};
  }
}

function writeNotes(notes: Record<string, FileNote[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useFileNotes(activeFileIds: string[]) {
  const [allNotes, setAllNotes] = useState<Record<string, FileNote[]>>({});

  useEffect(() => {
    setAllNotes(readNotes());
  }, []);

  const persist = useCallback((next: Record<string, FileNote[]>) => {
    setAllNotes(next);
    writeNotes(next);
  }, []);

  const getNotesForFile = useCallback(
    (fileId: string) => allNotes[fileId] || [],
    [allNotes],
  );

  const addNote = useCallback(
    (fileId: string, title: string, body: string) => {
      const now = new Date().toISOString();
      const note: FileNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileId,
        title: title.trim() || 'Untitled note',
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
      };

      persist({
        ...allNotes,
        [fileId]: [...(allNotes[fileId] || []), note],
      });

      return note;
    },
    [allNotes, persist],
  );

  const updateNote = useCallback(
    (fileId: string, noteId: string, title: string, body: string) => {
      const list = allNotes[fileId] || [];
      const nextList = list.map((n) =>
        n.id === noteId
          ? {
              ...n,
              title: title.trim() || n.title,
              body: body.trim(),
              updatedAt: new Date().toISOString(),
            }
          : n,
      );

      persist({
        ...allNotes,
        [fileId]: nextList,
      });
    },
    [allNotes, persist],
  );

  const deleteNote = useCallback(
    (fileId: string, noteId: string) => {
      const list = allNotes[fileId] || [];
      const nextList = list.filter((n) => n.id !== noteId);
      const next = { ...allNotes };

      if (nextList.length === 0) {
        delete next[fileId];
      } else {
        next[fileId] = nextList;
      }

      persist(next);
    },
    [allNotes, persist],
  );

  const deleteNotesForFile = useCallback(
    (fileId: string) => {
      const next = { ...allNotes };
      delete next[fileId];
      persist(next);
    },
    [allNotes, persist],
  );

  // Cleanup orphaned notes when active file list changes (skip if empty to avoid wiping all notes)
  useEffect(() => {
    if (activeFileIds.length === 0) {
      return;
    }

    const current = readNotes();
    const fileIdSet = new Set(activeFileIds);
    let changed = false;
    const next: Record<string, FileNote[]> = {};

    for (const [fileId, notes] of Object.entries(current)) {
      if (fileIdSet.has(fileId)) {
        next[fileId] = notes;
      } else {
        changed = true;
      }
    }

    if (changed) {
      persist(next);
    }
  }, [activeFileIds, persist]);

  return {
    getNotesForFile,
    addNote,
    updateNote,
    deleteNote,
    deleteNotesForFile,
  };
}
