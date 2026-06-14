import type { Dispatch, SetStateAction } from 'react';
import type { NotebookFilePreview } from '../../types';
import type { FileItem, Notebook } from './types';
import { MAX_NOTEBOOK_FILE_NAME_LENGTH } from './notebookHelpers';

export function useNotebookMaterialActions({
  fileChatActions,
  isDeleting,
  isDeletingNotebook,
  isRenaming,
  notebook,
  onDeleteFile,
  onDeleteNotebook,
  onRenameFile,
  onRetryFileSummary,
  pendingRenameFile,
  renameFileName,
  retryingSummaryFileId,
  selectedMaterial,
  setIsDeleteNotebookModalOpen,
  setIsDeleting,
  setIsDeletingNotebook,
  setIsRenaming,
  setPendingDeleteFile,
  setPendingRenameFile,
  setPreviewCache,
  setPreviewError,
  setRenameError,
  setRenameFileName,
  setRetryingSummaryFileId,
  setSelectedMaterial,
  setSummaryRetryError,
}: {
  fileChatActions: {
    updateRenamedFileChat: (file: FileItem, trimmedName: string) => void;
  };
  isDeleting: boolean;
  isDeletingNotebook: boolean;
  isRenaming: boolean;
  notebook: Notebook | null;
  onDeleteFile?: (notebookId: string, fileId: string) => Promise<void> | void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onRenameFile?: (notebookId: string, fileId: string, name: string) => Promise<void> | void;
  onRetryFileSummary?: (notebookId: string, fileId: string) => Promise<void> | void;
  pendingRenameFile: FileItem | null;
  renameFileName: string;
  retryingSummaryFileId: string | null;
  selectedMaterial: FileItem | null;
  setIsDeleteNotebookModalOpen: (isOpen: boolean) => void;
  setIsDeleting: (isDeleting: boolean) => void;
  setIsDeletingNotebook: (isDeleting: boolean) => void;
  setIsRenaming: (isRenaming: boolean) => void;
  setPendingDeleteFile: (file: FileItem | null) => void;
  setPendingRenameFile: (file: FileItem | null) => void;
  setPreviewCache: Dispatch<SetStateAction<Record<string, NotebookFilePreview>>>;
  setPreviewError: (error: string) => void;
  setRenameError: (error: string) => void;
  setRenameFileName: (name: string) => void;
  setRetryingSummaryFileId: (fileId: string | null) => void;
  setSelectedMaterial: Dispatch<SetStateAction<FileItem | null>>;
  setSummaryRetryError: (error: string) => void;
}) {
  const isRetryingSummary = Boolean(selectedMaterial && retryingSummaryFileId === selectedMaterial.id);

  const handleRetrySummary = async () => {
    if (!notebook || !selectedMaterial || !onRetryFileSummary) {
      return;
    }

    setRetryingSummaryFileId(selectedMaterial.id);
    setSummaryRetryError('');

    try {
      await onRetryFileSummary(notebook.id, selectedMaterial.id);
      setPreviewCache((current) => {
        const preview = current[selectedMaterial.id];

        if (!preview) {
          return current;
        }

        return {
          ...current,
          [selectedMaterial.id]: {
            ...preview,
            summaryError: undefined,
            summaryGeneratedAt: undefined,
            summaryStatus: 'in-progress',
          },
        };
      });
    } catch (error) {
      setSummaryRetryError(error instanceof Error ? error.message : 'Failed to retry description generation.');
    } finally {
      setRetryingSummaryFileId(null);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!notebook || !onDeleteFile || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setPreviewError('');

    try {
      await Promise.resolve(onDeleteFile(notebook.id, file.id));
      setPreviewCache((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });

      if (selectedMaterial?.id === file.id) {
        setSelectedMaterial(null);
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsDeleting(false);
      setPendingDeleteFile(null);
    }
  };

  const handleOpenRename = (file: FileItem) => {
    setPendingRenameFile(file);
    setRenameFileName(file.name);
    setRenameError('');
  };

  const handleRename = async () => {
    if (!notebook || !pendingRenameFile || !onRenameFile || isRenaming) {
      return;
    }

    const trimmedName = renameFileName.trim();

    if (!trimmedName) {
      setRenameError('Name is required.');
      return;
    }

    if (trimmedName.length > MAX_NOTEBOOK_FILE_NAME_LENGTH) {
      setRenameError(`Name must be ${MAX_NOTEBOOK_FILE_NAME_LENGTH} characters or fewer.`);
      return;
    }

    const file = pendingRenameFile;
    setIsRenaming(true);
    setRenameError('');

    try {
      await Promise.resolve(onRenameFile(notebook.id, file.id, trimmedName));

      setSelectedMaterial((current) => current?.id === file.id
        ? { ...current, name: trimmedName }
        : current);
      setPreviewCache((current) => {
        const preview = current[file.id];

        if (!preview) {
          return current;
        }

        return {
          ...current,
          [file.id]: {
            ...preview,
            name: trimmedName,
          },
        };
      });
      fileChatActions.updateRenamedFileChat(file, trimmedName);
      setPendingRenameFile(null);
      setRenameFileName('');
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : 'Rename failed.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteCurrentNotebook = async () => {
    if (!notebook || !onDeleteNotebook || isDeletingNotebook) {
      return;
    }

    setIsDeletingNotebook(true);
    setPreviewError('');

    try {
      await Promise.resolve(onDeleteNotebook(notebook.id));
      setSelectedMaterial(null);
      setPendingDeleteFile(null);
      setIsDeleteNotebookModalOpen(false);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsDeletingNotebook(false);
    }
  };

  return {
    handleDelete,
    handleDeleteCurrentNotebook,
    handleOpenRename,
    handleRename,
    handleRetrySummary,
    isRetryingSummary,
  };
}
