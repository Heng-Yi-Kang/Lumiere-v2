const { describeImageFileMock, execFileAsyncMock, execFileMock, transcribeAudioFileMock } = vi.hoisted(() => {
  const execFile = vi.fn();
  const execFileAsync = vi.fn();

  Object.assign(execFile, {
    [Symbol.for('nodejs.util.promisify.custom')]: execFileAsync,
  });

  return {
    describeImageFileMock: vi.fn(),
    execFileAsyncMock: execFileAsync,
    execFileMock: execFile,
    transcribeAudioFileMock: vi.fn(),
  };
});

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('@/lib/stt', () => ({
  transcribeAudioFile: transcribeAudioFileMock,
}));

vi.mock('@/lib/vlm', () => ({
  describeImageFile: describeImageFileMock,
  getVlmProviderConfig: vi.fn(() => ({
    apiKey: process.env.VLM_API_KEY || process.env.CHAT_API_KEY,
    baseUrl: process.env.VLM_API_BASE_URL || process.env.VLM_API_BASE || process.env.CHAT_API_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.VLM_MODEL || process.env.CHAT_MODEL,
  })),
}));

import {
  buildTimestampedTranscriptPreview,
  buildVideoRagSegments,
  getVideoFrameProviderConfig,
  processVideoFile,
} from './video-processing';

describe('buildVideoRagSegments', () => {
  it('combines coarse transcript slices and frame descriptions into timestamped RAG chunks', () => {
    const segments = buildVideoRagSegments({
      durationSeconds: 61,
      fileName: 'lecture.mp4',
      frameDescriptions: [
        {
          description: 'A slide titled Sorting Algorithms with a merge sort diagram.',
          timestamp: 5,
        },
        {
          description: 'The lecturer points at pseudocode for partitioning.',
          timestamp: 35,
        },
      ],
      segmentSeconds: 30,
      transcript: 'Sorting starts with comparison based methods then moves into partitioning and merge strategies for arrays.',
    });

    expect(segments).toHaveLength(3);
    expect(segments[0].content).toContain('Timestamp: 00:00 - 00:30');
    expect(segments[0].content).toContain('Sorting Algorithms');
    expect(segments[0].metadata.videoTimestampStart).toBe(0);
    expect(segments[1].content).toContain('Timestamp: 00:30 - 01:00');
    expect(segments[1].content).toContain('partitioning');
    expect(segments[2].content).toContain('Timestamp: 01:00 - 01:01');
    expect(segments[2].metadata.fileType).toBe('video');
  });
});

describe('buildTimestampedTranscriptPreview', () => {
  it('returns only timestamped transcript text for the frontend video preview', () => {
    const segments = buildVideoRagSegments({
      durationSeconds: 61,
      fileName: 'lecture.mp4',
      frameDescriptions: [
        {
          description: 'A slide titled Sorting Algorithms with a merge sort diagram.',
          timestamp: 5,
        },
      ],
      segmentSeconds: 30,
      transcript: 'Sorting starts with comparison based methods then moves into partitioning and merge strategies for arrays.',
    });

    const preview = buildTimestampedTranscriptPreview(segments);

    expect(preview).toContain('Timestamped transcript');
    expect(preview).toContain('[00:00 - 00:30]');
    expect(preview).toContain('[00:30 - 01:00]');
    expect(preview).toContain('[01:00 - 01:01]');
    expect(preview).toContain('Sorting starts');
    expect(preview).not.toContain('Visual description');
    expect(preview).not.toContain('Sorting Algorithms');
  });
});

describe('processVideoFile', () => {
  beforeEach(() => {
    execFileAsyncMock.mockReset();
    transcribeAudioFileMock.mockReset();
    describeImageFileMock.mockReset();
  });

  it('extracts compressed m4a audio for transcription', async () => {
    execFileAsyncMock.mockImplementation(async (command: string) => {
      if (command === 'ffprobe') {
        return { stdout: '61\n', stderr: '' };
      }

      if (command === 'ffmpeg') {
        return { stdout: '', stderr: '' };
      }

      throw new Error(`unexpected command: ${command}`);
    });
    transcribeAudioFileMock.mockResolvedValue('compressed transcript');
    describeImageFileMock.mockResolvedValue('A slide is visible.');

    const result = await processVideoFile({
      fileName: 'lecture.mp4',
      filePath: '/tmp/lecture.mp4',
    });

    expect(result.transcript).toBe('compressed transcript');
    expect(execFileAsyncMock).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'aac',
      '-b:a',
      '48k',
    ]), expect.any(Object));
    expect(transcribeAudioFileMock).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'lecture.m4a',
      mimeType: 'audio/mp4',
    }));
  });
});

describe('getVideoFrameProviderConfig', () => {
  const originalVlmApiBaseUrl = process.env.VLM_API_BASE_URL;
  const originalVlmApiBase = process.env.VLM_API_BASE;
  const originalChatApiBaseUrl = process.env.CHAT_API_BASE_URL;
  const originalVlmApiKey = process.env.VLM_API_KEY;
  const originalChatApiKey = process.env.CHAT_API_KEY;
  const originalVlmModel = process.env.VLM_MODEL;
  const originalChatModel = process.env.CHAT_MODEL;

  afterEach(() => {
    if (originalVlmApiBaseUrl === undefined) {
      delete process.env.VLM_API_BASE_URL;
    } else {
      process.env.VLM_API_BASE_URL = originalVlmApiBaseUrl;
    }
    if (originalVlmApiBase === undefined) {
      delete process.env.VLM_API_BASE;
    } else {
      process.env.VLM_API_BASE = originalVlmApiBase;
    }
    if (originalChatApiBaseUrl === undefined) {
      delete process.env.CHAT_API_BASE_URL;
    } else {
      process.env.CHAT_API_BASE_URL = originalChatApiBaseUrl;
    }
    if (originalVlmApiKey === undefined) {
      delete process.env.VLM_API_KEY;
    } else {
      process.env.VLM_API_KEY = originalVlmApiKey;
    }
    if (originalChatApiKey === undefined) {
      delete process.env.CHAT_API_KEY;
    } else {
      process.env.CHAT_API_KEY = originalChatApiKey;
    }
    if (originalVlmModel === undefined) {
      delete process.env.VLM_MODEL;
    } else {
      process.env.VLM_MODEL = originalVlmModel;
    }
    if (originalChatModel === undefined) {
      delete process.env.CHAT_MODEL;
    } else {
      process.env.CHAT_MODEL = originalChatModel;
    }
  });

  it('prefers VLM-specific settings and falls back to the legacy base env name', () => {
    process.env.VLM_API_BASE_URL = '';
    process.env.VLM_API_BASE = 'https://vision.example.test/v1';
    process.env.CHAT_API_BASE_URL = 'https://chat.example.test/v1';
    process.env.VLM_API_KEY = 'vision-key';
    process.env.CHAT_API_KEY = 'chat-key';
    process.env.VLM_MODEL = 'vision-model';
    process.env.CHAT_MODEL = 'chat-model';

    expect(getVideoFrameProviderConfig()).toEqual({
      apiKey: 'vision-key',
      baseUrl: 'https://vision.example.test/v1',
      model: 'vision-model',
    });
  });

  it('falls back to chat settings when VLM-specific settings are missing', () => {
    delete process.env.VLM_API_BASE_URL;
    delete process.env.VLM_API_BASE;
    process.env.CHAT_API_BASE_URL = 'https://chat.example.test/v1';
    delete process.env.VLM_API_KEY;
    process.env.CHAT_API_KEY = 'chat-key';
    delete process.env.VLM_MODEL;
    process.env.CHAT_MODEL = 'chat-model';

    expect(getVideoFrameProviderConfig()).toEqual({
      apiKey: 'chat-key',
      baseUrl: 'https://chat.example.test/v1',
      model: 'chat-model',
    });
  });
});
