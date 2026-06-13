import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { buildSttRequest, buildTranscriptionsUrl } from '@/lib/stt-request';

export { buildSttRequest } from '@/lib/stt-request';

const execFileAsync = promisify(execFile);
const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_STT_MAX_CHUNK_MB = 20;
const DEFAULT_STT_CHUNK_COMMAND_TIMEOUT_MS = 120_000;
const STT_CHUNK_TARGET_RATIO = 0.95;
const STT_MAX_CHUNKING_ATTEMPTS = 5;

type SttResponse = {
  text?: string;
};

export class SttError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new SttError(`${name} is required for audio transcription.`);
  }

  return value;
}

export function getSttModel() {
  return getRequiredEnv('STT_MODEL');
}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function getAudioDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], {
      timeout: getPositiveNumberEnv('STT_CHUNK_COMMAND_TIMEOUT_MS', DEFAULT_STT_CHUNK_COMMAND_TIMEOUT_MS),
    });
    const duration = Number(stdout.trim());

    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }

    throw new SttError('ffprobe returned an invalid audio duration.');
  } catch (error) {
    throw new SttError(`Audio chunking requires ffprobe duration metadata: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getAudioExtension(fileName: string, mimeType: string) {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();

  if (extension) {
    return extension;
  }

  return mimeType.split('/')[1]?.split(';')[0]?.trim().toLowerCase() || 'wav';
}

async function listChunkFiles(directory: string, fs: typeof import('node:fs').promises) {
  const fileNames = await fs.readdir(directory);

  return fileNames
    .filter((fileName) => fileName.startsWith('chunk-'))
    .sort((a, b) => a.localeCompare(b))
    .map((fileName) => path.join(directory, fileName));
}

async function splitAudioIntoChunks(params: {
  fileName: string;
  filePath: string;
  fs: typeof import('node:fs').promises;
  maxChunkBytes: number;
  mimeType: string;
}) {
  const durationSeconds = await getAudioDurationSeconds(params.filePath);
  const stats = await params.fs.stat(params.filePath);
  const targetChunkBytes = Math.max(1, Math.floor(params.maxChunkBytes * STT_CHUNK_TARGET_RATIO));
  let chunkCount = Math.max(2, Math.ceil(stats.size / targetChunkBytes));
  const extension = getAudioExtension(params.fileName, params.mimeType);

  for (let attempt = 1; attempt <= STT_MAX_CHUNKING_ATTEMPTS; attempt += 1) {
    const chunkDirectory = await params.fs.mkdtemp(path.join(os.tmpdir(), `lumiere-stt-${attempt}-`));
    const outputPattern = path.join(chunkDirectory, `chunk-%05d.${extension}`);
    const segmentSeconds = Math.max(1, durationSeconds / chunkCount);

    await execFileAsync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      params.filePath,
      '-map',
      '0:a:0',
      '-f',
      'segment',
      '-segment_time',
      String(segmentSeconds),
      '-reset_timestamps',
      '1',
      '-c',
      'copy',
      outputPattern,
    ], {
      timeout: getPositiveNumberEnv('STT_CHUNK_COMMAND_TIMEOUT_MS', DEFAULT_STT_CHUNK_COMMAND_TIMEOUT_MS),
    });

    const chunkPaths = await listChunkFiles(chunkDirectory, params.fs);

    if (!chunkPaths.length) {
      await params.fs.rm(chunkDirectory, { recursive: true, force: true }).catch(() => undefined);
      throw new SttError('Audio chunking did not produce any audio segments.');
    }

    const chunkStats = await Promise.all(chunkPaths.map((chunkPath) => params.fs.stat(chunkPath)));
    const largestChunkBytes = Math.max(...chunkStats.map((chunk) => chunk.size));

    if (largestChunkBytes <= params.maxChunkBytes) {
      return {
        chunkDirectory,
        chunkPaths,
      };
    }

    await params.fs.rm(chunkDirectory, { recursive: true, force: true }).catch(() => undefined);
    chunkCount = Math.max(chunkCount + 1, Math.ceil((chunkCount * largestChunkBytes) / targetChunkBytes));
  }

  throw new SttError(`Unable to split audio into chunks at or below ${Math.floor(params.maxChunkBytes / BYTES_PER_MB)} MB.`);
}

async function transcribeBuffer(params: {
  apiKey: string;
  baseUrl: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  model: string;
}) {
  const request = buildSttRequest({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    buffer: params.buffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    model: params.model,
  });

  const response = await fetch(buildTranscriptionsUrl(params.baseUrl), {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SttError(`Transcription request failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as SttResponse;
  const transcript = payload.text?.trim();

  if (!transcript) {
    throw new SttError('Transcription provider returned no text.');
  }

  return transcript;
}

export async function transcribeAudioFile(params: {
  fileName: string;
  filePath: string;
  mimeType: string;
}) {
  const baseUrl = getRequiredEnv('STT_API_BASE');
  const apiKey = getRequiredEnv('STT_API_KEY');
  const model = getSttModel();
  const maxChunkBytes = Math.floor(getPositiveNumberEnv('STT_MAX_CHUNK_MB', DEFAULT_STT_MAX_CHUNK_MB) * BYTES_PER_MB);
  const stats = await fs.stat(params.filePath);

  if (stats.size <= maxChunkBytes) {
    return transcribeBuffer({
      apiKey,
      baseUrl,
      buffer: await fs.readFile(params.filePath),
      fileName: params.fileName,
      mimeType: params.mimeType,
      model,
    });
  }

  const { chunkDirectory, chunkPaths } = await splitAudioIntoChunks({
    fileName: params.fileName,
    filePath: params.filePath,
    fs,
    maxChunkBytes,
    mimeType: params.mimeType,
  });

  try {
    const transcripts: string[] = [];

    for (const [index, chunkPath] of chunkPaths.entries()) {
      transcripts.push(await transcribeBuffer({
        apiKey,
        baseUrl,
        buffer: await fs.readFile(chunkPath),
        fileName: `${path.parse(params.fileName).name}-part-${String(index + 1).padStart(3, '0')}.${getAudioExtension(params.fileName, params.mimeType)}`,
        mimeType: params.mimeType,
        model,
      }));
    }

    return transcripts.join('\n\n');
  } finally {
    await fs.rm(chunkDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
