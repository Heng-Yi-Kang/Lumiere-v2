import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import {
  getMaxUploadBytes,
  getUploadLimitExceededMessage,
  NotebookFileValidationError,
} from '@/lib/notebook-files';
import { getNotebookUploadRoot } from '@/lib/notebook-upload-root';

const execFileAsync = promisify(execFile);
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const DEFAULT_YOUTUBE_COMMAND_TIMEOUT_MS = 20 * 60 * 1000;
const YOUTUBE_DOWNLOAD_FORMAT = [
  'bv*[height<=720][ext=mp4]+ba[ext=m4a]',
  'b[height<=720][ext=mp4]',
  'bv*[height<=720]+ba',
  'b[height<=720]',
].join('/');

type YtDlpJson = {
  filesize?: number;
  filesize_approx?: number;
  id?: string;
  is_live?: boolean;
  live_status?: string;
  title?: string;
  webpage_url?: string;
};

type CommandRunner = (
  command: string,
  args: string[],
  options: { maxBuffer: number; timeout: number },
) => Promise<{ stderr: string; stdout: string }>;

type YoutubeCommandDeps = {
  runCommand?: CommandRunner;
};

export type YoutubeVideoMetadata = {
  canonicalUrl: string;
  estimatedSizeBytes: number | null;
  title: string;
  videoId: string;
};

export type YoutubeDownloadResult = {
  mimeType: string;
  size: string;
  sizeBytes: number;
  sourcePath: string;
};

export class YoutubeVideoValidationError extends NotebookFileValidationError {}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
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

function getYtDlpMaxFilesizeArg(maxUploadBytes = getMaxUploadBytes()) {
  return `${Math.ceil(maxUploadBytes / 1024 / 1024)}M`;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return baseName.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'youtube-video';
}

function buildCanonicalYoutubeUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function getYoutubeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
}

function extractYoutubeVideoId(parsedUrl: URL) {
  const host = getYoutubeHost(parsedUrl.hostname);
  const pathnameParts = parsedUrl.pathname.split('/').filter(Boolean);

  if (parsedUrl.searchParams.has('list')) {
    throw new YoutubeVideoValidationError('Playlist URLs are not supported. Add a single YouTube video instead.');
  }

  if (host === 'youtu.be') {
    const videoId = pathnameParts[0];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  if (host !== 'youtube.com') {
    throw new YoutubeVideoValidationError('Enter a YouTube video URL from youtube.com or youtu.be.');
  }

  if (parsedUrl.pathname === '/watch') {
    const videoId = parsedUrl.searchParams.get('v');
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  if (['shorts', 'live', 'embed'].includes(pathnameParts[0] || '')) {
    const videoId = pathnameParts[1];
    if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  throw new YoutubeVideoValidationError('Enter a public single-video YouTube URL.');
}

export function normalizeYoutubeVideoUrl(value: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new YoutubeVideoValidationError('Enter a valid YouTube URL.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new YoutubeVideoValidationError('Only http and https YouTube URLs are supported.');
  }

  const videoId = extractYoutubeVideoId(parsedUrl);

  return {
    canonicalUrl: buildCanonicalYoutubeUrl(videoId),
    videoId,
  };
}

async function defaultRunCommand(command: string, args: string[], options: { maxBuffer: number; timeout: number }) {
  return execFileAsync(command, args, options);
}

async function runYtDlp(args: string[], deps: YoutubeCommandDeps = {}) {
  const runner = deps.runCommand ?? defaultRunCommand;

  try {
    return await runner('yt-dlp', args, {
      maxBuffer: 1024 * 1024 * 4,
      timeout: getPositiveNumberEnv('YOUTUBE_DOWNLOAD_TIMEOUT_MS', DEFAULT_YOUTUBE_COMMAND_TIMEOUT_MS),
    });
  } catch (error) {
    throw new YoutubeVideoValidationError(`YouTube ingestion failed. ${sanitizeErrorMessage(error)}`);
  }
}

export async function probeYoutubeVideoMetadata(url: string, deps: YoutubeCommandDeps = {}): Promise<YoutubeVideoMetadata> {
  const normalized = normalizeYoutubeVideoUrl(url);
  const { stdout } = await runYtDlp([
    '--dump-single-json',
    '--no-playlist',
    '--skip-download',
    normalized.canonicalUrl,
  ], deps);

  let payload: YtDlpJson;
  try {
    payload = JSON.parse(stdout) as YtDlpJson;
  } catch {
    throw new YoutubeVideoValidationError('YouTube metadata probe returned an invalid response.');
  }

  if (payload.id && payload.id !== normalized.videoId) {
    throw new YoutubeVideoValidationError('Only single YouTube videos are supported.');
  }

  if (payload.is_live || payload.live_status === 'is_live') {
    throw new YoutubeVideoValidationError('Live YouTube streams are not supported until they are available as videos.');
  }

  const estimatedSizeBytes = Number(payload.filesize ?? payload.filesize_approx);
  const maxUploadBytes = getMaxUploadBytes();
  if (Number.isFinite(estimatedSizeBytes) && estimatedSizeBytes > maxUploadBytes) {
    throw new YoutubeVideoValidationError(getUploadLimitExceededMessage('YouTube video', maxUploadBytes));
  }

  return {
    canonicalUrl: normalized.canonicalUrl,
    estimatedSizeBytes: Number.isFinite(estimatedSizeBytes) && estimatedSizeBytes > 0 ? estimatedSizeBytes : null,
    title: payload.title?.trim() || `YouTube video ${normalized.videoId}`,
    videoId: normalized.videoId,
  };
}

export function isCanonicalYoutubeVideoUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    normalizeYoutubeVideoUrl(value);
    return true;
  } catch {
    return false;
  }
}

export async function downloadYoutubeVideoForNotebook(params: {
  notebookId: string;
  title: string;
  url: string;
}, deps: YoutubeCommandDeps = {}): Promise<YoutubeDownloadResult> {
  const startedAt = performance.now();
  const metadata = await probeYoutubeVideoMetadata(params.url, deps);
  const notebookDirectory = path.join(getNotebookUploadRoot(), params.notebookId);
  await fs.mkdir(notebookDirectory, { recursive: true });

  const safeName = sanitizeFileName(`${params.title || metadata.title}.mp4`);
  const storedPath = path.join(notebookDirectory, `${crypto.randomUUID()}-${safeName}`);

  logBackendProcess('info', 'youtube.download.started', {
    notebookId: params.notebookId,
    url: metadata.canonicalUrl,
    videoId: metadata.videoId,
  });

  try {
    await runYtDlp([
      '--no-playlist',
      '--max-filesize',
      getYtDlpMaxFilesizeArg(),
      '-f',
      YOUTUBE_DOWNLOAD_FORMAT,
      '--merge-output-format',
      'mp4',
      '-o',
      storedPath,
      metadata.canonicalUrl,
    ], deps);

    const stats = await fs.stat(storedPath);
    if (stats.size <= 0) {
      throw new YoutubeVideoValidationError('Downloaded YouTube video is empty.');
    }

    const maxUploadBytes = getMaxUploadBytes();
    if (stats.size > maxUploadBytes) {
      throw new YoutubeVideoValidationError(getUploadLimitExceededMessage('YouTube video', maxUploadBytes));
    }

    logBackendProcess('info', 'youtube.download.completed', {
      elapsedMs: getElapsedMs(startedAt),
      fileSizeBytes: stats.size,
      notebookId: params.notebookId,
      videoId: metadata.videoId,
    });

    return {
      mimeType: 'video/mp4',
      size: formatBytes(stats.size),
      sizeBytes: stats.size,
      sourcePath: storedPath,
    };
  } catch (error) {
    await fs.rm(storedPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export const youtubeDownloadFormatForTests = YOUTUBE_DOWNLOAD_FORMAT;
