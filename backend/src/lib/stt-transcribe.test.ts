import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { execFileAsyncMock, execFileMock } = vi.hoisted(() => {
  const execFile = vi.fn();
  const execFileAsync = vi.fn();

  Object.assign(execFile, {
    [Symbol.for('nodejs.util.promisify.custom')]: execFileAsync,
  });

  return {
    execFileAsyncMock: execFileAsync,
    execFileMock: execFile,
  };
});

vi.mock('child_process', () => ({
  execFile: execFileMock,
}));

import { transcribeAudioFile } from './stt';

describe('transcribeAudioFile', () => {
  const originalFetch = global.fetch;
  const originalSttApiBase = process.env.STT_API_BASE;
  const originalSttApiKey = process.env.STT_API_KEY;
  const originalSttModel = process.env.STT_MODEL;
  const originalSttMaxChunkMb = process.env.STT_MAX_CHUNK_MB;
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lumiere-stt-test-'));
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'test-key';
    process.env.STT_MODEL = 'qwen3-asr-1.7b';
    delete process.env.STT_MAX_CHUNK_MB;
    execFileAsyncMock.mockReset();
  });

  afterEach(async () => {
    if (originalSttApiBase === undefined) {
      delete process.env.STT_API_BASE;
    } else {
      process.env.STT_API_BASE = originalSttApiBase;
    }
    if (originalSttApiKey === undefined) {
      delete process.env.STT_API_KEY;
    } else {
      process.env.STT_API_KEY = originalSttApiKey;
    }
    if (originalSttModel === undefined) {
      delete process.env.STT_MODEL;
    } else {
      process.env.STT_MODEL = originalSttModel;
    }
    if (originalSttMaxChunkMb === undefined) {
      delete process.env.STT_MAX_CHUNK_MB;
    } else {
      process.env.STT_MAX_CHUNK_MB = originalSttMaxChunkMb;
    }
    global.fetch = originalFetch;
    execFileAsyncMock.mockReset();
    await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
  });

  it('sends small audio files as one transcription request', async () => {
    const filePath = path.join(tempDirectory, 'lecture.wav');
    await fs.writeFile(filePath, Buffer.from('audio-bytes'));
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'small transcript' })));

    await expect(transcribeAudioFile({
      fileName: 'lecture.wav',
      filePath,
      mimeType: 'audio/wav',
    })).resolves.toBe('small transcript');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(execFileAsyncMock).not.toHaveBeenCalled();
  });

  it('splits oversized audio into valid chunks before transcription', async () => {
    process.env.STT_MAX_CHUNK_MB = '0.00001';
    const filePath = path.join(tempDirectory, 'lecture.wav');
    await fs.writeFile(filePath, Buffer.alloc(25, 1));
    execFileAsyncMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'ffprobe') {
        return { stdout: '90\n', stderr: '' };
      }

      if (command === 'ffmpeg') {
        const outputPattern = args.at(-1);

        if (!outputPattern) {
          throw new Error('missing output pattern');
        }

        await fs.mkdir(path.dirname(outputPattern), { recursive: true });
        await Promise.all([0, 1, 2].map((index) => fs.writeFile(
          outputPattern.replace('%05d', String(index).padStart(5, '0')),
          Buffer.alloc(8, index + 1),
        )));
        return { stdout: '', stderr: '' };
      }

      throw new Error(`unexpected command: ${command}`);
    });
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: 'first chunk' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: 'second chunk' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: 'third chunk' })));

    await expect(transcribeAudioFile({
      fileName: 'lecture.wav',
      filePath,
      mimeType: 'audio/wav',
    })).resolves.toBe('first chunk\n\nsecond chunk\n\nthird chunk');

    expect(execFileAsyncMock).toHaveBeenCalledWith('ffprobe', expect.any(Array), expect.any(Object));
    expect(execFileAsyncMock).toHaveBeenCalledWith('ffmpeg', expect.arrayContaining([
      '-segment_time',
      '30',
      '-c',
      'copy',
    ]), expect.any(Object));
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
