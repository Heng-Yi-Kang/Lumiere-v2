import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getNotebookUploadRoot } from '@/lib/notebook-upload-root';
import { prisma } from '@/lib/prisma';

const execFileAsync = promisify(execFile);
const DEFAULT_HLS_COMMAND_TIMEOUT_MS = 20 * 60 * 1000;
const HLS_SEGMENT_SECONDS = 6;

type VideoProbeResult = {
  durationSeconds: number | null;
  height: number | null;
  width: number | null;
};

export type HlsStatusPayload = {
  hlsGeneratedAt?: string;
  hlsMasterPlaylistUrl?: string;
  hlsStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  videoDurationSeconds?: number;
  videoResolution?: string;
};

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function buildHlsPlaylistUrl(notebookId: string, fileId: string) {
  return `/uploads/notebooks/${encodeURIComponent(notebookId)}/${encodeURIComponent(fileId)}/hls/master.m3u8`;
}

export function getNotebookFileHlsDirectory(notebookId: string, fileId: string) {
  return path.join(getNotebookUploadRoot(), notebookId, fileId, 'hls');
}

export function serializeHlsStatus(file: {
  hlsGeneratedAt?: Date | null;
  hlsMasterPlaylistUrl?: string | null;
  hlsStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  videoDurationSeconds?: number | null;
  videoResolution?: string | null;
}): HlsStatusPayload {
  return {
    hlsGeneratedAt: file.hlsGeneratedAt?.toISOString(),
    hlsMasterPlaylistUrl: file.hlsMasterPlaylistUrl ?? undefined,
    hlsStatus: file.hlsStatus,
    videoDurationSeconds: file.videoDurationSeconds ?? undefined,
    videoResolution: file.videoResolution ?? undefined,
  };
}

async function runMediaCommand(command: string, args: string[]) {
  try {
    return await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024 * 4,
      timeout: getPositiveNumberEnv('HLS_COMMAND_TIMEOUT_MS', DEFAULT_HLS_COMMAND_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${command} failed: ${sanitizeErrorMessage(error)}`);
  }
}

async function probeVideo(filePath: string): Promise<VideoProbeResult> {
  const { stdout } = await runMediaCommand('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    filePath,
  ]);
  const payload = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ height?: number; width?: number }>;
  };
  const stream = payload.streams?.[0];
  const duration = Number(payload.format?.duration);

  return {
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : null,
    height: Number.isFinite(stream?.height) ? stream?.height ?? null : null,
    width: Number.isFinite(stream?.width) ? stream?.width ?? null : null,
  };
}

async function generateHlsVariants(sourcePath: string, outputDirectory: string) {
  await fs.rm(outputDirectory, { recursive: true, force: true });
  await fs.mkdir(path.join(outputDirectory, '720p'), { recursive: true });
  await fs.mkdir(path.join(outputDirectory, '480p'), { recursive: true });

  await generateHlsVariant({
    audioBitrate: '128k',
    maxrate: '2996k',
    outputDirectory: path.join(outputDirectory, '720p'),
    resolutionWidth: 1280,
    resolutionHeight: 720,
    sourcePath,
    videoBitrate: '2800k',
    videoBufferSize: '4200k',
  });
  await generateHlsVariant({
    audioBitrate: '96k',
    maxrate: '1498k',
    outputDirectory: path.join(outputDirectory, '480p'),
    resolutionWidth: 854,
    resolutionHeight: 480,
    sourcePath,
    videoBitrate: '1400k',
    videoBufferSize: '2100k',
  });

  await fs.writeFile(path.join(outputDirectory, 'master.m3u8'), [
    '#EXTM3U',
    '#EXT-X-VERSION:6',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    '#EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720',
    '720p/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=1498000,AVERAGE-BANDWIDTH=1400000,RESOLUTION=854x480',
    '480p/index.m3u8',
    '',
  ].join('\n'), 'utf8');
}

async function generateHlsVariant(params: {
  audioBitrate: string;
  maxrate: string;
  outputDirectory: string;
  resolutionHeight: number;
  resolutionWidth: number;
  sourcePath: string;
  videoBitrate: string;
  videoBufferSize: string;
}) {
  await runMediaCommand('ffmpeg', [
    '-y',
    '-i',
    params.sourcePath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    `scale=w=${params.resolutionWidth}:h=${params.resolutionHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    '-c:v',
    'libx264',
    '-b:v',
    params.videoBitrate,
    '-maxrate',
    params.maxrate,
    '-bufsize',
    params.videoBufferSize,
    '-c:a',
    'aac',
    '-b:a',
    params.audioBitrate,
    '-ac',
    '2',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-g',
    '180',
    '-sc_threshold',
    '0',
    '-f',
    'hls',
    '-hls_time',
    String(HLS_SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    path.join(params.outputDirectory, 'segment-%05d.ts'),
    path.join(params.outputDirectory, 'index.m3u8'),
  ]);
}

export async function generateNotebookFileHls(fileId: string) {
  const startedAt = performance.now();
  const file = await prisma.notebookFile.findUnique({
    where: { id: fileId },
    select: {
      hlsStatus: true,
      id: true,
      notebookId: true,
      sourcePath: true,
      type: true,
    },
  });

  if (!file || file.type !== 'video' || !file.sourcePath) {
    return;
  }

  await prisma.notebookFile.update({
    where: { id: file.id },
    data: {
      hlsStatus: 'PROCESSING',
      hlsGeneratedAt: null,
      hlsMasterPlaylistUrl: null,
    },
  });

  const outputDirectory = getNotebookFileHlsDirectory(file.notebookId, file.id);

  try {
    logBackendProcess('info', 'file.hls.started', {
      fileId: file.id,
      notebookId: file.notebookId,
    });

    const probe = await probeVideo(file.sourcePath);
    await generateHlsVariants(file.sourcePath, outputDirectory);

    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        hlsGeneratedAt: new Date(),
        hlsMasterPlaylistUrl: buildHlsPlaylistUrl(file.notebookId, file.id),
        hlsStatus: 'READY',
        videoDurationSeconds: probe.durationSeconds,
        videoResolution: probe.width && probe.height ? `${probe.width}x${probe.height}` : null,
      },
    });

    logBackendProcess('info', 'file.hls.completed', {
      elapsedMs: getElapsedMs(startedAt),
      fileId: file.id,
      notebookId: file.notebookId,
    });
  } catch (error) {
    await fs.rm(outputDirectory, { recursive: true, force: true }).catch(() => undefined);
    await prisma.notebookFile.update({
      where: { id: file.id },
      data: {
        hlsGeneratedAt: null,
        hlsMasterPlaylistUrl: null,
        hlsStatus: 'FAILED',
      },
    }).catch(() => undefined);

    logBackendProcess('error', 'file.hls.failed', {
      elapsedMs: getElapsedMs(startedAt),
      error: sanitizeErrorMessage(error),
      fileId: file.id,
      notebookId: file.notebookId,
    });
  }
}

export function startNotebookFileHlsJob(fileId: string) {
  setTimeout(() => {
    void generateNotebookFileHls(fileId);
  }, 0);
}
