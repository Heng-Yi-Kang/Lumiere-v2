import { execFile } from 'child_process';
import { promisify } from 'util';
import { transcribeAudioFile } from '@/lib/stt';

const execFileAsync = promisify(execFile);
const DEFAULT_AUDIO_SEGMENT_SECONDS = 30;
const DEFAULT_AUDIO_COMMAND_TIMEOUT_MS = 30_000;

export type AudioRagSegment = {
  content: string;
  metadata: {
    audioTimestampEnd: number;
    audioTimestampStart: number;
    fileName: string;
    fileType: 'audio';
    transcript: string;
    timestampEnd: number;
    timestampStart: number;
  };
};

export type AudioPreviewResult = {
  durationSeconds: number | null;
  previewContent: string;
  ragSegments: AudioRagSegment[];
  transcript: string;
};

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

async function getAudioDurationSeconds(filePath: string) {
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
      timeout: getPositiveNumberEnv('AUDIO_COMMAND_TIMEOUT_MS', DEFAULT_AUDIO_COMMAND_TIMEOUT_MS),
    });
    const duration = Number(stdout.trim());

    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

export function buildAudioRagSegments(params: {
  durationSeconds: number | null;
  fileName: string;
  segmentSeconds?: number;
  transcript: string;
}) {
  const segmentSeconds = Math.max(1, params.segmentSeconds || DEFAULT_AUDIO_SEGMENT_SECONDS);
  const durationSeconds = Math.max(segmentSeconds, Math.ceil(params.durationSeconds || segmentSeconds));
  const segmentCount = Math.max(1, Math.ceil(durationSeconds / segmentSeconds));
  const transcriptSlices = splitWordsEvenly(params.transcript, segmentCount);

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * segmentSeconds;
    const end = Math.min(durationSeconds, start + segmentSeconds);
    const transcript = transcriptSlices[index] || '';
    const content = [
      `Audio segment: ${params.fileName}`,
      `Timestamp: ${formatTimestamp(start)} - ${formatTimestamp(end)}`,
      transcript ? `Transcript:\n${transcript}` : 'Transcript: No spoken transcript is available for this segment.',
    ].join('\n\n');

    return {
      content,
      metadata: {
        audioTimestampEnd: end,
        audioTimestampStart: start,
        fileName: params.fileName,
        fileType: 'audio' as const,
        transcript,
        timestampEnd: end,
        timestampStart: start,
      },
    };
  });
}

export function buildTimestampedAudioTranscriptPreview(segments: AudioRagSegment[]) {
  const transcriptSegments = segments
    .map((segment) => {
      const transcript = segment.metadata.transcript.trim();

      if (!transcript) {
        return undefined;
      }

      return [
        `[${formatTimestamp(segment.metadata.timestampStart)} - ${formatTimestamp(segment.metadata.timestampEnd)}]`,
        transcript,
      ].join('\n');
    })
    .filter((segment): segment is string => Boolean(segment));

  if (!transcriptSegments.length) {
    return 'No spoken transcript is available for this audio.';
  }

  return [
    'Timestamped transcript',
    '',
    ...transcriptSegments,
  ].join('\n');
}

export async function processAudioFile(params: {
  fileName: string;
  filePath: string;
  mimeType: string;
}) {
  const [transcript, durationSeconds] = await Promise.all([
    transcribeAudioFile(params),
    getAudioDurationSeconds(params.filePath),
  ]);
  const ragSegments = buildAudioRagSegments({
    durationSeconds,
    fileName: params.fileName,
    segmentSeconds: getPositiveNumberEnv('AUDIO_SEGMENT_SECONDS', DEFAULT_AUDIO_SEGMENT_SECONDS),
    transcript,
  });
  const previewContent = buildTimestampedAudioTranscriptPreview(ragSegments);

  return {
    durationSeconds,
    previewContent,
    ragSegments,
    transcript,
  } satisfies AudioPreviewResult;
}
