export const NOTEBOOK_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const NOTEBOOK_UPLOAD_LIMIT_UPGRADE_MESSAGE = 'Upgrade to the Pro version to upload larger files.';
export const NOTEBOOK_ACCEPTED_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'txt',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'flac',
  'aac',
  'mp4',
  'mov',
  'm4v',
  'webm',
] as const;

export const NOTEBOOK_UPLOAD_ACCEPT = NOTEBOOK_ACCEPTED_EXTENSIONS
  .map((extension) => `.${extension}`)
  .join(',');

export type SupportedNotebookExtension = (typeof NOTEBOOK_ACCEPTED_EXTENSIONS)[number];

const VIDEO_NOTEBOOK_EXTENSIONS = new Set<SupportedNotebookExtension>([
  'mp4',
  'mov',
  'm4v',
  'webm',
]);

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase();
}

export function isSupportedNotebookExtension(
  value: string | undefined,
): value is SupportedNotebookExtension {
  return NOTEBOOK_ACCEPTED_EXTENSIONS.includes(value as SupportedNotebookExtension);
}

export function isVideoNotebookExtension(
  value: SupportedNotebookExtension | undefined,
) {
  return value ? VIDEO_NOTEBOOK_EXTENSIONS.has(value) : false;
}

export function validateNotebookUpload(file: File) {
  const extension = getFileExtension(file.name);

  if (!extension || !isSupportedNotebookExtension(extension)) {
    return 'Only PDF, DOCX, PPTX, TXT, common image files, common audio files, and common video files are supported.';
  }

  if (file.size <= 0) {
    return 'Empty files cannot be uploaded.';
  }

  if (file.size > NOTEBOOK_MAX_UPLOAD_BYTES) {
    return `File exceeds the 100 MB upload limit. ${NOTEBOOK_UPLOAD_LIMIT_UPGRADE_MESSAGE}`;
  }

  return null;
}

export function validateNotebookUploadBatch(files: File[]) {
  if (files.length === 0) {
    return 'Select at least one file to upload.';
  }

  let totalBytes = 0;

  for (const file of files) {
    const validationError = validateNotebookUpload(file);
    if (validationError) {
      return `${file.name}: ${validationError}`;
    }

    totalBytes += file.size;
  }

  if (totalBytes > NOTEBOOK_MAX_UPLOAD_BYTES) {
    return `Selected files exceed the 100 MB upload limit. ${NOTEBOOK_UPLOAD_LIMIT_UPGRADE_MESSAGE}`;
  }

  return null;
}
