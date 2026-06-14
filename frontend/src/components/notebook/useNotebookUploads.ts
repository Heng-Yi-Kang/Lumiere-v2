import { RefObject, useEffect, useMemo, useState } from 'react';
import { getGenericUploadErrorMessage } from '../../lib/apiErrors';
import { validateNotebookUploadBatch } from '../../lib/notebookUpload';
import type { SupportedNotebookExtension } from '../../lib/notebookUpload';
import type { Notebook, UploadPhase, UploadQueueItem } from './types';
import { getUploadProgressValue, getUploadStatusLabel } from './uploadProgress';

export function useNotebookUploads({
  fileInputRef,
  notebook,
  onUploadFile,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  notebook: Notebook | null;
  onUploadFile?: (notebookId: string, files: File[]) => Promise<void> | void;
}) {
  const [uploadError, setUploadError] = useState('');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileCount, setUploadFileCount] = useState(0);
  const [completedUploadCount, setCompletedUploadCount] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  useEffect(() => {
    if (uploadPhase !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUploadPhase('idle');
      setUploadFileName('');
      setUploadFileCount(0);
      setCompletedUploadCount(0);
      setUploadQueue([]);
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [uploadPhase]);

  const uploadProgress = getUploadProgressValue(uploadPhase);
  const isUploadActive = uploadPhase === 'validating' || uploadPhase === 'uploading' || uploadPhase === 'extracting';
  const hasUploadFailure = uploadQueue.some((item) => item.status === 'failed');
  const shouldShowUploadQueue = uploadQueue.length > 0 && (isUploadActive || uploadPhase === 'success' || Boolean(uploadError));
  const uploadStatusLabel = useMemo(() => getUploadStatusLabel({
    uploadFileCount,
    uploadPhase,
    uploadQueue,
  }), [uploadFileCount, uploadPhase, uploadQueue]);
  const uploadSummaryLabel = hasUploadFailure
    ? `${completedUploadCount} of ${uploadFileCount} files uploaded before the batch stopped`
    : uploadFileCount > 1
      ? `${completedUploadCount} of ${uploadFileCount} files complete`
      : uploadFileName;

  const handleUpload = async (files: File[]) => {
    if (!notebook || !onUploadFile) {
      return;
    }

    const validationError = validateNotebookUploadBatch(files);
    if (validationError) {
      setUploadError(validationError);
      setUploadPhase('idle');
      return;
    }

    setUploadError('');
    setUploadFileName(files[0].name);
    setUploadFileCount(files.length);
    setCompletedUploadCount(0);
    setUploadQueue(files.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      extension: (file.name.split('.').pop()?.toLowerCase() as SupportedNotebookExtension) || 'pdf',
      progress: 0,
      status: 'queued',
    })));
    setUploadPhase('validating');

    try {
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 10, status: 'validating' })));
      await Promise.resolve();
      setUploadPhase('uploading');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 45, status: 'uploading' })));
      await Promise.resolve();
      setUploadPhase('extracting');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 82, status: 'extracting' })));
      await Promise.resolve(onUploadFile(notebook.id, files));
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 100, status: 'done' })));
      setCompletedUploadCount(files.length);
      setUploadPhase('success');
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setUploadPhase('idle');
      setUploadQueue((current) => current.map((item) =>
        item.status === 'done' ? item : { ...item, status: 'failed' },
      ));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return {
    actions: {
      handleUpload,
      setUploadError,
    },
    state: {
      completedUploadCount,
      hasUploadFailure,
      isUploadActive,
      shouldShowUploadQueue,
      uploadError,
      uploadFileCount,
      uploadFileName,
      uploadPhase,
      uploadProgress,
      uploadQueue,
      uploadStatusLabel,
      uploadSummaryLabel,
    },
  };
}
