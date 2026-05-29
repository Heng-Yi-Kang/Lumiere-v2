import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_UPLOAD_BYTES,
  NotebookFileValidationError,
  persistNotebookUpload,
} from './notebook-files';

describe('persistNotebookUpload', () => {
  const originalUploadRoot = process.env.NOTEBOOK_UPLOAD_ROOT;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-upload-test-'));
    process.env.NOTEBOOK_UPLOAD_ROOT = tempDir;
  });

  afterEach(async () => {
    process.env.NOTEBOOK_UPLOAD_ROOT = originalUploadRoot;
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
});
