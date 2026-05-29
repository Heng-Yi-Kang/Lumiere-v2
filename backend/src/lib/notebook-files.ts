import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { OfficeParser } from 'officeparser';
import sanitizeHtml from 'sanitize-html';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads', 'notebooks');
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type SupportedNotebookFileType = 'pdf' | 'docx' | 'pptx' | 'txt';
type PreviewFormat = 'pdf' | 'html' | 'text';

const MIME_TYPE_MAP: Record<SupportedNotebookFileType, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
};

type UploadResult = {
  extractedText?: string;
  mimeType: string;
  name: string;
  previewContent?: string;
  previewFormat?: PreviewFormat;
  size: string;
  sourcePath: string;
  sourceUrl: string;
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

export class NotebookFileValidationError extends Error {}

function getFileExtension(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase();
}

function isSupportedNotebookFileType(value: string): value is SupportedNotebookFileType {
  return value === 'pdf' || value === 'docx' || value === 'pptx' || value === 'txt';
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

function buildSummary(text: string | undefined, fileName: string) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return `Uploaded material for ${fileName}. Preview is available in the notebook viewer.`;
  }

  return cleaned.length > 280 ? `${cleaned.slice(0, 277)}...` : cleaned;
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

async function buildPdfPreview(filePath: string) {
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

async function buildDerivedPreview(type: SupportedNotebookFileType, filePath: string): Promise<DerivedPreview> {
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
  const extension = getFileExtension(file.name);

  if (!isSupportedNotebookFileType(extension)) {
    throw new NotebookFileValidationError('Only pdf, docx, pptx, and txt files are supported.');
  }

  if (file.size <= 0) {
    throw new NotebookFileValidationError('Uploaded file is empty.');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new NotebookFileValidationError('File exceeds the 100 MB upload limit.');
  }

  const allowedMimeTypes = MIME_TYPE_MAP[extension];
  if (file.type && !allowedMimeTypes.includes(file.type)) {
    throw new NotebookFileValidationError(`Invalid MIME type for .${extension} file.`);
  }

  const notebookDirectory = path.join(UPLOAD_ROOT, notebookId);
  await fs.mkdir(notebookDirectory, { recursive: true });

  const safeName = sanitizeFileName(file.name);
  const storedName = `${randomUUID()}-${safeName}`;
  const storedPath = path.join(notebookDirectory, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, buffer);

  const sourceUrl = `/uploads/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(storedName)}`;

  try {
    const preview = await buildDerivedPreview(extension, storedPath);

    return {
      extractedText: preview.extractedText,
      mimeType: file.type || allowedMimeTypes[0],
      name: file.name,
      previewContent: preview.previewContent,
      previewFormat: preview.previewFormat,
      size: formatBytes(file.size),
      sourcePath: storedPath,
      sourceUrl,
      summary: buildSummary(preview.extractedText, file.name),
      totalPages: preview.totalPages,
      type: extension,
      uploadDate: formatUploadDate(new Date()),
    };
  } catch (error) {
    await fs.unlink(storedPath).catch(() => undefined);
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
