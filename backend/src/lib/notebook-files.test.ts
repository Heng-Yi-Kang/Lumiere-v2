import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_UPLOAD_BYTES,
  NotebookFileValidationError,
  persistNotebookUpload,
} from './notebook-files';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('persistNotebookUpload', () => {
  const originalUploadRoot = process.env.NOTEBOOK_UPLOAD_ROOT;
  const originalSttApiBase = process.env.STT_API_BASE;
  const originalSttApiKey = process.env.STT_API_KEY;
  const originalSttModel = process.env.STT_MODEL;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-upload-test-'));
    process.env.NOTEBOOK_UPLOAD_ROOT = tempDir;
  });

  afterEach(async () => {
    restoreEnv('NOTEBOOK_UPLOAD_ROOT', originalUploadRoot);
    restoreEnv('STT_API_BASE', originalSttApiBase);
    restoreEnv('STT_API_KEY', originalSttApiKey);
    restoreEnv('STT_MODEL', originalSttModel);
    vi.unstubAllGlobals();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists a txt upload and stores it under the configured upload root', async () => {
    const upload = new File(['Hello notebook'], 'lecture-notes.txt', {
      type: 'text/plain',
    });

    const result = await persistNotebookUpload('nb-1', upload);

    expect(result.type).toBe('txt');
    expect(result.previewFormat).toBe('text');
    expect(result.previewContent).toContain('Hello notebook');
    expect(result.sourcePath).toContain(path.join('nb-1', ''));

    const storedFile = await stat(result.sourcePath);
    expect(storedFile.isFile()).toBe(true);
  });

  it('rejects unsupported file extensions', async () => {
    const upload = new File(['bad'], 'malware.exe', {
      type: 'application/octet-stream',
    });

    await expect(persistNotebookUpload('nb-1', upload)).rejects.toBeInstanceOf(
      NotebookFileValidationError,
    );
  });

  it('rejects files larger than the configured upload limit before writing to disk', async () => {
    const oversizedFile = new File(['x'], 'too-large.txt', {
      type: 'text/plain',
    });

    Object.defineProperty(oversizedFile, 'size', {
      value: MAX_UPLOAD_BYTES + 1,
      configurable: true,
    });

    await expect(persistNotebookUpload('nb-1', oversizedFile)).rejects.toBeInstanceOf(
      NotebookFileValidationError,
    );
  });

  it('transcribes audio uploads and stores the transcript as text preview content', async () => {
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'test-key';
    process.env.STT_MODEL = 'qwen3-asr-1.7b';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'Audio transcript for indexing.',
    })));
    vi.stubGlobal('fetch', fetchMock);

    const upload = new File(['audio-bytes'], 'lecture.mp3', {
      type: 'audio/mpeg',
    });

    const result = await persistNotebookUpload('nb-1', upload);

    expect(result.type).toBe('audio');
    expect(result.previewFormat).toBe('text');
    expect(result.previewContent).toBe('Audio transcript for indexing.');
    expect(result.extractedText).toBe('Audio transcript for indexing.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://stt.example.test/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-key',
        },
      }),
    );
  });

  it('removes the stored audio file when transcription fails', async () => {
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'test-key';
    process.env.STT_MODEL = 'qwen3-asr-1.7b';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })));

    const upload = new File(['audio-bytes'], 'lecture.mp3', {
      type: 'audio/mpeg',
    });

    await expect(persistNotebookUpload('nb-1', upload)).rejects.toThrow(/Transcription request failed/);

    const storedFiles = await readdir(path.join(tempDir, 'nb-1')).catch(() => []);
    expect(storedFiles).toEqual([]);
  });
});
