import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Save, X, Clock, FileText } from 'lucide-react';
import { FileNote } from '../types';
import { getNotebookColorTone } from '../lib/notebookColors';
import MarkdownEditor, { renderMarkdown } from './MarkdownEditor';

interface FileNotesPanelProps {
  fileId: string;
  fileName: string;
  notes: FileNote[];
  notebookColor?: string;
  isLoading?: boolean;
  isMutating?: boolean;
  error?: string;
  onRetry?: () => void;
  onAdd: (fileId: string, title: string, body: string) => Promise<void>;
  onUpdate: (fileId: string, noteId: string, title: string, body: string) => Promise<void>;
  onDelete: (fileId: string, noteId: string) => Promise<void>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FileNotesPanel({
  fileId,
  fileName,
  notes,
  notebookColor,
  isLoading = false,
  isMutating = false,
  error = '',
  onRetry,
  onAdd,
  onUpdate,
  onDelete,
}: FileNotesPanelProps) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const colorTone = notebookColor ? getNotebookColorTone(notebookColor) : null;

  const startNew = () => {
    setEditingId('new');
    setDraftTitle('');
    setDraftBody('');
  };

  const startEdit = (note: FileNote) => {
    setEditingId(note.id);
    setDraftTitle(note.title);
    setDraftBody(note.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftTitle('');
    setDraftBody('');
  };

  const handleSave = async () => {
    if (!draftTitle.trim() && !draftBody.trim()) {
      cancelEdit();
      return;
    }

    if (editingId === 'new') {
      await onAdd(fileId, draftTitle, draftBody);
    } else if (editingId) {
      await onUpdate(fileId, editingId, draftTitle, draftBody);
    }

    setEditingId(null);
    setDraftTitle('');
    setDraftBody('');
  };

  const isFormOpen = editingId !== null;
  const isDisabled = isMutating || Boolean(error);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated/40 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-primary font-mono">
            <FileText className="h-4 w-4 text-accent-hover" />
            Notes
          </div>
          <p className="mt-1 truncate text-[10px] text-text-muted">
            {notes.length} note{notes.length === 1 ? '' : 's'} for {fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          disabled={isFormOpen || isDisabled || isLoading}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add note
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-sm text-text-muted">
            Loading notes...
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-2xl border border-error/20 bg-error-subtle p-4 text-sm text-error">
            <p>{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex items-center rounded-xl border border-error/30 px-3 py-1.5 text-xs font-bold transition hover:bg-error/15"
              >
                Retry loading notes
              </button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && isFormOpen && (
          <div className="rounded-2xl border border-border-subtle bg-bg-elevated/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Note title..."
                disabled={isMutating}
                className="min-w-0 flex-1 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-bold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={isMutating}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSave();
                  }}
                  disabled={isMutating}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition hover:bg-accent-hover"
                  title="Save note"
                >
                  <Save className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <MarkdownEditor
              value={draftBody}
              onChange={setDraftBody}
              placeholder="Write your note here... (Markdown supported)"
            />
          </div>
        )}

        {!isLoading && !error && notes.length === 0 && !isFormOpen && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-default px-4 py-10 text-center">
            <FileText className="h-8 w-8 text-text-muted" />
            <p className="text-sm text-text-muted">No notes yet for this file.</p>
            <button
              type="button"
              onClick={startNew}
              disabled={isDisabled}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first note
            </button>
          </div>
        )}

        {!isLoading && !error && notes.map((note) => (
          <div
            key={note.id}
            className="rounded-2xl border border-border-subtle bg-bg-elevated/40 p-4 transition hover:bg-bg-elevated/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs font-extrabold text-text-primary font-display">
                  {note.title}
                </h4>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(note.updatedAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(note)}
                  disabled={isFormOpen || isDisabled}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  title="Edit note"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void onDelete(fileId, note.id);
                  }}
                  disabled={isFormOpen || isDisabled}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-error/20 bg-error-subtle text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Delete note"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            {note.body && (
              <div className="mt-3 border-t border-border-subtle pt-2">
                <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1">
                  {renderMarkdown(note.body)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
