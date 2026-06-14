import { LoaderCircle } from 'lucide-react';
import type { FileItem, Notebook } from './types';
import { MAX_NOTEBOOK_FILE_NAME_LENGTH } from './notebookHelpers';

export function DeleteMaterialModal({
  isDeleting,
  onClose,
  onDelete,
  pendingDeleteFile,
}: {
  isDeleting: boolean;
  onClose: () => void;
  onDelete: (file: FileItem) => void;
  pendingDeleteFile: FileItem;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="surface-glass w-full max-w-md rounded-3xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-black text-text-primary font-display">Delete material?</h3>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary font-serif">
          This removes <span className="font-semibold text-text-primary">{pendingDeleteFile.name}</span> from the notebook and deletes the stored file immediately.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(pendingDeleteFile)}
            disabled={isDeleting}
            className="rounded-xl border border-error/20 bg-error-subtle px-4 py-2 text-xs font-bold text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? 'Deleting...' : 'Delete file'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RenameMaterialModal({
  isRenaming,
  onClose,
  onRename,
  renameError,
  renameFileName,
  setRenameError,
  setRenameFileName,
}: {
  isRenaming: boolean;
  onClose: () => void;
  onRename: () => void;
  renameError: string;
  renameFileName: string;
  setRenameError: (error: string) => void;
  setRenameFileName: (name: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-material-title"
      onClick={() => {
        if (!isRenaming) {
          onClose();
        }
      }}
    >
      <div
        className="surface-glass w-full max-w-md rounded-3xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="rename-material-title" className="text-lg font-black text-text-primary font-display">Rename material</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary font-serif">
          This changes the display name only. File links and stored uploads stay unchanged.
        </p>
        <label className="mt-5 block text-[10px] font-black uppercase tracking-widest text-text-muted font-mono" htmlFor="rename-material-input">
          Name
        </label>
        <input
          id="rename-material-input"
          type="text"
          value={renameFileName}
          maxLength={MAX_NOTEBOOK_FILE_NAME_LENGTH}
          onChange={(event) => {
            setRenameFileName(event.target.value);
            if (renameError) {
              setRenameError('');
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onRename();
            }
          }}
          disabled={isRenaming}
          autoFocus
          className="mt-2 w-full rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-sm font-semibold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="min-h-4 text-xs font-semibold text-error">{renameError}</p>
          <span className="shrink-0 text-[10px] font-bold text-text-muted">
            {renameFileName.trim().length}/{MAX_NOTEBOOK_FILE_NAME_LENGTH}
          </span>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isRenaming}
            className="rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRename}
            disabled={isRenaming || !renameFileName.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRenaming ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {isRenaming ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteNotebookModal({
  isDeletingNotebook,
  notebook,
  onClose,
  onDelete,
}: {
  isDeletingNotebook: boolean;
  notebook: Notebook;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="surface-glass w-full max-w-md rounded-3xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-black text-text-primary font-display">Delete notebook?</h3>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary font-serif">
          This removes <span className="font-semibold text-text-primary">{notebook.name}</span>, all notebook records, and all stored files immediately.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={isDeletingNotebook}
            className="rounded-xl border border-error/20 bg-error-subtle px-4 py-2 text-xs font-bold text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeletingNotebook ? 'Deleting...' : 'Delete notebook'}
          </button>
        </div>
      </div>
    </div>
  );
}
