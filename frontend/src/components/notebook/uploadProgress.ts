import { isVideoNotebookExtension } from '../../lib/notebookUpload';
import type { PendingLink, UploadPhase, UploadQueueItem } from './types';

export function getUploadProgressValue(uploadPhase: UploadPhase) {
  return uploadPhase === 'validating'
    ? 10
    : uploadPhase === 'uploading'
      ? 45
      : uploadPhase === 'extracting'
        ? 82
        : uploadPhase === 'success'
          ? 100
          : 0;
}

export function getUploadStatusLabel(input: {
  uploadFileCount: number;
  uploadPhase: UploadPhase;
  uploadQueue: UploadQueueItem[];
}) {
  const hasVideoUpload = input.uploadQueue.some((item) => isVideoNotebookExtension(item.extension));

  return input.uploadPhase === 'validating'
    ? input.uploadFileCount > 1
      ? `Validating ${input.uploadFileCount} files before upload...`
      : 'Validating file before upload...'
    : input.uploadPhase === 'uploading'
      ? input.uploadFileCount > 1
        ? `Sending ${input.uploadFileCount} files to notebook storage...`
        : 'Sending file to notebook storage...'
      : input.uploadPhase === 'extracting'
        ? hasVideoUpload
          ? 'Video uploaded. Backend transcript extraction and indexing are running; this page will update automatically while open.'
          : input.uploadFileCount > 1
            ? `Extracting ${input.uploadFileCount} files and refreshing notebook...`
            : 'Extracting preview content and refreshing notebook...'
        : input.uploadPhase === 'success'
          ? hasVideoUpload
            ? 'Upload finished. Video processing continues in the background; this page will update automatically while open.'
            : input.uploadFileCount > 1
              ? `Uploaded ${input.uploadFileCount} files successfully.`
              : 'Upload finished. Material is ready.'
          : '';
}

export function getPendingLinkStatusLabel(pendingLink: PendingLink | null) {
  if (!pendingLink) {
    return '';
  }

  return pendingLink.kind === 'youtube'
    ? pendingLink.status === 'failed'
      ? 'YouTube video failed'
      : pendingLink.progress >= 100
        ? 'YouTube video queued'
        : pendingLink.progress >= 70
          ? 'Adding video to notebook...'
          : pendingLink.progress >= 36
            ? 'Fetching video metadata...'
            : 'Validating YouTube video...'
    : pendingLink.status === 'failed'
      ? 'Web link failed'
      : pendingLink.progress >= 100
        ? 'Web link indexed'
        : pendingLink.progress >= 70
          ? 'Indexing readable study context...'
          : pendingLink.progress >= 36
            ? 'Extracting readable page text...'
            : 'Fetching web page...';
}
