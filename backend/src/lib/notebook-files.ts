import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { generateNotebookFileSummary } from '@/lib/file-summary';
import { transcribeAudioFile } from '@/lib/stt';
import { processVideoFile, type VideoRagSegment } from '@/lib/video-processing';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type SupportedNotebookFileType = 'pdf' | 'docx' | 'pptx' | 'txt' | 'audio' | 'video';
type PreviewFormat = 'pdf' | 'html' | 'text';

const MIME_TYPE_MAP: Record<SupportedNotebookFileType, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  audio: [
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/mp3',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/x-m4a',
    'audio/x-wav',
  ],
  video: [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
  ],
};

const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'webm']);

type UploadResult = {
  extractedText?: string;
  mimeType: string;
  name: string;
  previewContent?: string;
  previewFormat?: PreviewFormat;
  ragChunks?: VideoRagSegment[];
  size: string;
  sourcePath: string;
  summary?: string;
  totalPages?: number;
  type: SupportedNotebookFileType;
  uploadDate: string;
};

type DerivedPreview = {
  extractedText: string;
  previewContent?: string;
  previewFormat: PreviewFormat;
  totalPages?: number;
};

type OfficeParserModule = typeof import('officeparser');

const require = createRequire(import.meta.url);
let officeParserModulePromise: Promise<OfficeParserModule> | undefined;

export class NotebookFileValidationError extends Error {}

export function getNotebookUploadRoot() {
  return process.env.NOTEBOOK_UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads', 'notebooks');
}

export function buildNotebookStoredFileUrl(notebookId: string, sourcePath: string | null | undefined) {
  if (!sourcePath) {
    return undefined;
  }

  const storedName = path.basename(sourcePath);
  return `/uploads/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(storedName)}`;
}

function getFileExtension(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase();
}

function getNotebookFileType(value: string): SupportedNotebookFileType | undefined {
  if (VIDEO_EXTENSIONS.has(value)) {
    return 'video';
  }

  if (AUDIO_EXTENSIONS.has(value)) {
    return 'audio';
  }

  if (value === 'pdf' || value === 'docx' || value === 'pptx' || value === 'txt') {
    return value;
  }

  return undefined;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return baseName.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'upload';
}

function formatUploadDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

async function buildStoredSummary(params: {
  fileName: string;
  fileType: SupportedNotebookFileType;
  text: string | undefined;
}) {
  try {
    return await generateNotebookFileSummary({
      fileName: params.fileName,
      fileType: params.fileType,
      text: params.text || '',
    });
  } catch {
    return undefined;
  }
}

function sanitizePreviewHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt'],
      '*': ['class'],
    },
    allowedSchemes: ['data', 'http', 'https'],
  });
}

async function getOfficeParser() {
  officeParserModulePromise ??= Promise.resolve(
    require('officeparser') as OfficeParserModule,
  );

  return officeParserModulePromise;
}

async function buildPdfPreview(filePath: string) {
  const { OfficeParser } = await getOfficeParser();
  const ast = await OfficeParser.parseOffice(filePath);

  return {
    extractedText: ast.toText(),
    previewFormat: 'pdf' as const,
    totalPages: ast.metadata.pages,
  } satisfies DerivedPreview;
}

async function buildDocxPreview(filePath: string) {
  const [htmlResult, rawTextResult] = await Promise.all([
    mammoth.convertToHtml({ path: filePath }),
    mammoth.extractRawText({ path: filePath }),
  ]);

  return {
    extractedText: rawTextResult.value,
    previewContent: sanitizePreviewHtml(htmlResult.value),
    previewFormat: 'html' as const,
  } satisfies DerivedPreview;
}

async function buildPptxPreview(filePath: string) {
  const { OfficeParser } = await getOfficeParser();
  const ast = await OfficeParser.parseOffice(filePath, {
    ignoreNotes: false,
  });
  const html = await ast.to('html');
  const totalSlides = ast.content.filter((node) => node.type === 'slide').length;

  return {
    extractedText: ast.toText(),
    previewContent: sanitizePreviewHtml(String(html.value)),
    previewFormat: 'html' as const,
    totalPages: totalSlides || ast.metadata.pages,
  } satisfies DerivedPreview;
}

async function buildTxtPreview(filePath: string) {
  const text = await fs.readFile(filePath, 'utf8');

  return {
    extractedText: text,
    previewContent: text,
    previewFormat: 'text' as const,
  } satisfies DerivedPreview;
}

async function buildAudioPreview(filePath: string, fileName: string, mimeType: string): Promise<DerivedPreview> {
  const transcript = await transcribeAudioFile({
    fileName,
    filePath,
    mimeType,
  });

  return {
    extractedText: transcript,
    previewContent: transcript,
    previewFormat: 'text' as const,
  } satisfies DerivedPreview;
}

async function buildVideoPreview(filePath: string, fileName: string): Promise<DerivedPreview & { ragChunks: VideoRagSegment[] }> {
  const result = await processVideoFile({
    fileName,
    filePath,
  });

  return {
    extractedText: result.transcript,
    previewContent: result.previewContent,
    previewFormat: 'text' as const,
    ragChunks: result.ragSegments,
  };
}

async function buildDerivedPreview(
  type: Exclude<SupportedNotebookFileType, 'audio' | 'video'>,
  filePath: string,
): Promise<DerivedPreview> {
  switch (type) {
    case 'pdf':
      return buildPdfPreview(filePath);
    case 'docx':
      return buildDocxPreview(filePath);
    case 'pptx':
      return buildPptxPreview(filePath);
    case 'txt':
      return buildTxtPreview(filePath);
    default:
      throw new NotebookFileValidationError('Unsupported file type.');
  }
}

export async function persistNotebookUpload(notebookId: string, file: File): Promise<UploadResult> {
  const uploadStartedAt = performance.now();
  const extension = getFileExtension(file.name);
  const fileType = getNotebookFileType(extension);

  logBackendProcess('info', 'file.upload.received', {
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || null,
    notebookId,
  });

  if (!fileType) {
    logBackendProcess('warn', 'file.upload.rejected', {
      extension,
      fileName: file.name,
      reason: 'unsupported_extension',
    });
    throw new NotebookFileValidationError('Only pdf, docx, pptx, txt, common audio files, and common video files are supported.');
  }

  if (file.size <= 0) {
    logBackendProcess('warn', 'file.upload.rejected', {
      fileName: file.name,
      reason: 'empty_file',
    });
    throw new NotebookFileValidationError('Uploaded file is empty.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    logBackendProcess('warn', 'file.upload.rejected', {
      fileName: file.name,
      fileSizeBytes: file.size,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      reason: 'file_too_large',
    });
    throw new NotebookFileValidationError('File exceeds the 100 MB upload limit.');
  }

  const allowedMimeTypes = MIME_TYPE_MAP[fileType];
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    logBackendProcess('warn', 'file.upload.rejected', {
      extension,
      fileName: file.name,
      mimeType: file.type,
      reason: 'invalid_mime_type',
    });
    throw new NotebookFileValidationError(`Invalid MIME type for .${extension} file.`);
  }

  const notebookDirectory = path.join(getNotebookUploadRoot(), notebookId);
  await fs.mkdir(notebookDirectory, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const storedName = `${randomUUID()}-${safeName}`;
  const storedPath = path.join(notebookDirectory, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, buffer);
  logBackendProcess('info', 'file.storage.written', {
    elapsedMs: getElapsedMs(uploadStartedAt),
    fileName: file.name,
    fileSizeBytes: buffer.byteLength,
    fileType,
    notebookId,
    storedName,
  });

  try {
    const extractionStartedAt = performance.now();
    logBackendProcess('info', 'file.extraction.started', {
      fileName: file.name,
      fileType,
      notebookId,
    });

    const preview = fileType === 'audio'
      ? await buildAudioPreview(storedPath, file.name, file.type || allowedMimeTypes[0])
      : fileType === 'video'
        ? await buildVideoPreview(storedPath, file.name)
        : await buildDerivedPreview(fileType, storedPath);

    logBackendProcess('info', 'file.extraction.completed', {
      elapsedMs: getElapsedMs(extractionStartedAt),
      extractedTextChars: preview.extractedText.length,
      fileName: file.name,
      fileType,
      notebookId,
      previewFormat: preview.previewFormat,
      totalPages: preview.totalPages,
    });

    const summaryStartedAt = performance.now();
    logBackendProcess('info', 'file.summary.started', {
      extractedTextChars: preview.extractedText.length,
      fileName: file.name,
      fileType,
      notebookId,
    });

    const summary = await buildStoredSummary({
      fileName: file.name,
      fileType,
      text: preview.extractedText,
    });

    logBackendProcess('info', 'file.summary.completed', {
      elapsedMs: getElapsedMs(summaryStartedAt),
      fileName: file.name,
      notebookId,
      summaryChars: summary?.length || 0,
    });

    logBackendProcess('info', 'file.upload.completed', {
      elapsedMs: getElapsedMs(uploadStartedAt),
      extractedTextChars: preview.extractedText.length,
      fileName: file.name,
      fileType,
      notebookId,
    });

    const ragChunks = (preview as { ragChunks?: VideoRagSegment[] }).ragChunks;

    return {
      extractedText: preview.extractedText,
      mimeType: file.type || allowedMimeTypes[0],
      name: file.name,
      previewContent: preview.previewContent,
      previewFormat: preview.previewFormat,
      ragChunks,
      size: formatBytes(file.size),
      sourcePath: storedPath,
      summary,
      totalPages: preview.totalPages,
      type: fileType,
      uploadDate: formatUploadDate(new Date()),
    };
  } catch (error) {
    await fs.unlink(storedPath).catch(() => undefined);
    logBackendProcess('error', 'file.upload.failed', {
      elapsedMs: getElapsedMs(uploadStartedAt),
      error: error instanceof Error ? error.message : 'Unknown upload processing error',
      fileName: file.name,
      notebookId,
    });
    throw error;
  }
}

export async function deleteNotebookStoredFile(paths: Array<string | null | undefined>) {
  await Promise.all(
    paths
      .filter((value): value is string => Boolean(value))
      .map(async (targetPath) => {
        await fs.unlink(targetPath).catch(() => undefined);
      }),
  );
}
