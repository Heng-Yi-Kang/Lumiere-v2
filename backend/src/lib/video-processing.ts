import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { transcribeAudioFile } from '@/lib/stt';

const execFileAsync = promisify(execFile);
const DEFAULT_VIDEO_SEGMENT_SECONDS = 30;
const DEFAULT_VIDEO_MAX_FRAMES = 60;
const DEFAULT_VIDEO_COMMAND_TIMEOUT_MS = 120_000;
const DEFAULT_VLM_TIMEOUT_MS = 45_000;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
};

export type VideoRagSegment = {
  content: string;
  metadata: {
    fileName: string;
    fileType: 'video';
    frameDescription: string;
    transcript: string;
    videoTimestampEnd: number;
    videoTimestampStart: number;
  };
};

type FrameDescription = {
  description: string;
  timestamp: number;
};

export type VideoPreviewResult = {
  durationSeconds: number;
  previewContent: string;
  ragSegments: VideoRagSegment[];
  transcript: string;
};

export class VideoProcessingError extends Error {}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

export function getVideoFrameProviderConfig() {
  return {
    apiKey: getOptionalEnv('VLM_API_KEY', 'CHAT_API_KEY'),
    baseUrl: getOptionalEnv('VLM_API_BASE_URL', 'VLM_API_BASE', 'CHAT_API_BASE_URL') || 'https://api.openai.com/v1',
    model: getOptionalEnv('VLM_MODEL', 'CHAT_MODEL'),
  };
}

function formatTimestamp(seconds: number) {
  const normalized = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(normalized / 60);
  const remainingSeconds = normalized % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function splitWordsEvenly(text: string, segmentCount: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (!words.length || segmentCount <= 0) {
    return Array.from({ length: Math.max(segmentCount, 0) }, () => '');
  }

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = Math.floor((index * words.length) / segmentCount);
    const end = Math.floor(((index + 1) * words.length) / segmentCount);
    return words.slice(start, Math.max(end, start + 1)).join(' ');
  });
}

export function buildVideoRagSegments(params: {
  durationSeconds: number;
  fileName: string;
  frameDescriptions: FrameDescription[];
  segmentSeconds?: number;
  transcript: string;
}) {
  const segmentSeconds = Math.max(1, params.segmentSeconds || DEFAULT_VIDEO_SEGMENT_SECONDS);
  const durationSeconds = Math.max(segmentSeconds, Math.ceil(params.durationSeconds || segmentSeconds));
  const segmentCount = Math.max(1, Math.ceil(durationSeconds / segmentSeconds));
  const transcriptSlices = splitWordsEvenly(params.transcript, segmentCount);

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * segmentSeconds;
    const end = Math.min(durationSeconds, start + segmentSeconds);
    const matchingDescriptions = params.frameDescriptions
      .filter((frame) => frame.timestamp >= start && frame.timestamp < end)
      .map((frame) => `[${formatTimestamp(frame.timestamp)}] ${frame.description}`);
    const transcript = transcriptSlices[index] || '';
    const frameDescription = matchingDescriptions.join('\n');
    const content = [
      `Video segment: ${params.fileName}`,
      `Timestamp: ${formatTimestamp(start)} - ${formatTimestamp(end)}`,
      frameDescription ? `Visual description:\n${frameDescription}` : 'Visual description: No sampled frame description is available for this segment.',
      transcript ? `Transcript:\n${transcript}` : 'Transcript: No spoken transcript is available for this segment.',
    ].join('\n\n');

    return {
      content,
      metadata: {
        fileName: params.fileName,
        fileType: 'video' as const,
        frameDescription,
        transcript,
        videoTimestampEnd: end,
        videoTimestampStart: start,
      },
    };
  });
}

export function buildTimestampedTranscriptPreview(segments: VideoRagSegment[]) {
  const transcriptSegments = segments
    .map((segment) => {
      const transcript = segment.metadata.transcript.trim();

      if (!transcript) {
        return undefined;
      }

      return [
        `[${formatTimestamp(segment.metadata.videoTimestampStart)} - ${formatTimestamp(segment.metadata.videoTimestampEnd)}]`,
        transcript,
      ].join('\n');
    })
    .filter((segment): segment is string => Boolean(segment));

  if (!transcriptSegments.length) {
    return 'No spoken transcript is available for this video.';
  }

  return [
    'Timestamped transcript',
    '',
    ...transcriptSegments,
  ].join('\n');
}

async function runMediaCommand(command: string, args: string[]) {
  try {
    return await execFileAsync(command, args, {
      timeout: getPositiveNumberEnv('VIDEO_COMMAND_TIMEOUT_MS', DEFAULT_VIDEO_COMMAND_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new VideoProcessingError(`${command} failed: ${message}`);
  }
}

async function getVideoDurationSeconds(filePath: string) {
  const { stdout } = await runMediaCommand('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number(stdout.trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VideoProcessingError('Unable to determine video duration.');
  }

  return duration;
}

async function extractAudioTrack(videoPath: string, outputPath: string) {
  await runMediaCommand('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    outputPath,
  ]);
}

function buildFrameTimestamps(durationSeconds: number) {
  const segmentSeconds = getPositiveNumberEnv('VIDEO_SEGMENT_SECONDS', DEFAULT_VIDEO_SEGMENT_SECONDS);
  const maxFrames = Math.max(1, Math.floor(getPositiveNumberEnv('VIDEO_MAX_FRAMES', DEFAULT_VIDEO_MAX_FRAMES)));
  const frameCount = Math.min(maxFrames, Math.max(1, Math.ceil(durationSeconds / segmentSeconds)));
  const spacing = durationSeconds / frameCount;

  return Array.from({ length: frameCount }, (_, index) =>
    Math.min(durationSeconds - 0.1, Math.max(0, (index * spacing) + (spacing / 2))),
  );
}

async function extractFrames(videoPath: string, outputDirectory: string, durationSeconds: number) {
  const timestamps = buildFrameTimestamps(durationSeconds);
  const frames: Array<{ filePath: string; timestamp: number }> = [];

  for (const [index, timestamp] of timestamps.entries()) {
    const framePath = path.join(outputDirectory, `frame-${String(index).padStart(3, '0')}.jpg`);
    await runMediaCommand('ffmpeg', [
      '-y',
      '-ss',
      timestamp.toFixed(3),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      framePath,
    ]);
    frames.push({ filePath: framePath, timestamp });
  }

  return frames;
}

async function describeFrame(filePath: string) {
  const { apiKey, baseUrl, model } = getVideoFrameProviderConfig();

  if (!apiKey || !model) {
    throw new VideoProcessingError('VLM_API_KEY/CHAT_API_KEY and VLM_MODEL/CHAT_MODEL are required for video frame description.');
  }

  const image = await fs.readFile(filePath);
  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    signal: AbortSignal.timeout(getPositiveNumberEnv('VLM_TIMEOUT_MS', DEFAULT_VLM_TIMEOUT_MS)),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: 180,
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Describe this video frame for study retrieval.',
                'Mention visible slide text, diagrams, equations, labels, people, objects, and actions.',
                'Keep it to one or two concise sentences.',
              ].join(' '),
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image.toString('base64')}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new VideoProcessingError(`Frame description failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const answer = payload.choices?.[0]?.message?.content?.trim() || payload.choices?.[0]?.message?.reasoning?.trim();

  if (!answer) {
    throw new VideoProcessingError('VLM provider returned no frame description.');
  }

  return answer;
}

async function describeFrames(frames: Array<{ filePath: string; timestamp: number }>) {
  const descriptions: FrameDescription[] = [];

  for (const frame of frames) {
    descriptions.push({
      description: await describeFrame(frame.filePath),
      timestamp: frame.timestamp,
    });
  }

  return descriptions;
}

export async function processVideoFile(params: {
  fileName: string;
  filePath: string;
}) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), `lumiere-video-${randomUUID()}-`));
  const audioPath = path.join(tempDirectory, 'audio.wav');

  try {
    const durationSeconds = await getVideoDurationSeconds(params.filePath);
    await extractAudioTrack(params.filePath, audioPath);
    const transcript = await transcribeAudioFile({
      fileName: `${path.parse(params.fileName).name}.wav`,
      filePath: audioPath,
      mimeType: 'audio/wav',
    });
    const frames = await extractFrames(params.filePath, tempDirectory, durationSeconds);
    const frameDescriptions = await describeFrames(frames);
    const ragSegments = buildVideoRagSegments({
      durationSeconds,
      fileName: params.fileName,
      frameDescriptions,
      segmentSeconds: getPositiveNumberEnv('VIDEO_SEGMENT_SECONDS', DEFAULT_VIDEO_SEGMENT_SECONDS),
      transcript,
    });
    const previewContent = buildTimestampedTranscriptPreview(ragSegments);

    return {
      durationSeconds,
      previewContent,
      ragSegments,
      transcript,
    } satisfies VideoPreviewResult;
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
