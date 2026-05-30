export const NOTEBOOK_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const NOTEBOOK_ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'] as const;

export type SupportedNotebookExtension = (typeof NOTEBOOK_ACCEPTED_EXTENSIONS)[number];

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase();
}

export function isSupportedNotebookExtension(
  value: string | undefined,
): value is SupportedNotebookExtension {
  return NOTEBOOK_ACCEPTED_EXTENSIONS.includes(value as SupportedNotebookExtension);
}

export function validateNotebookUpload(file: File) {
  const extension = getFileExtension(file.name);

  if (!extension || !isSupportedNotebookExtension(extension)) {
    return 'Only PDF, DOCX, PPTX, TXT, and common audio files are supported.';
  }

  if (file.size <= 0) {
    return 'Empty files cannot be uploaded.';
  }

  if (file.size > NOTEBOOK_MAX_UPLOAD_BYTES) {
    return 'File exceeds the 100 MB upload limit.';
  }

  return null;
}
