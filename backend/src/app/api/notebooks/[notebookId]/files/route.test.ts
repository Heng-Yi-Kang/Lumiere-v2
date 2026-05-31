import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_UPLOAD_BYTES } from '@/lib/notebook-files';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      delete: vi.fn(),
    },
    notebook: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/rag', () => ({
  indexNotebookFileForRag: vi.fn().mockResolvedValue(1),
}));

import { POST } from './route';
import { indexNotebookFileForRag } from '@/lib/rag';

describe('POST /api/notebooks/[notebookId]/files', () => {
  const originalUploadRoot = process.env.NOTEBOOK_UPLOAD_ROOT;
  const originalChatApiBaseUrl = process.env.CHAT_API_BASE_URL;
  const originalChatApiKey = process.env.CHAT_API_KEY;
  const originalChatModel = process.env.CHAT_MODEL;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'notebook-route-test-'));
    process.env.NOTEBOOK_UPLOAD_ROOT = tempDir;
    delete process.env.CHAT_API_BASE_URL;
    delete process.env.CHAT_API_KEY;
    delete process.env.CHAT_MODEL;
    prismaMock.notebookFile.delete.mockReset();
    prismaMock.notebook.findUnique.mockReset();
    prismaMock.notebook.update.mockReset();
    vi.mocked(indexNotebookFileForRag).mockResolvedValue(1);
  });

  afterEach(async () => {
    process.env.NOTEBOOK_UPLOAD_ROOT = originalUploadRoot;
    if (originalChatApiBaseUrl === undefined) {
      delete process.env.CHAT_API_BASE_URL;
    } else {
      process.env.CHAT_API_BASE_URL = originalChatApiBaseUrl;
    }
    if (originalChatApiKey === undefined) {
      delete process.env.CHAT_API_KEY;
    } else {
      process.env.CHAT_API_KEY = originalChatApiKey;
    }
    if (originalChatModel === undefined) {
      delete process.env.CHAT_MODEL;
    } else {
      process.env.CHAT_MODEL = originalChatModel;
    }
    vi.unstubAllGlobals();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uploads a supported file and returns the refreshed notebook payload', async () => {
    const returnedNotebook = {
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      files: [
        {
          id: 'file-1',
          name: 'week-1.txt',
          type: 'txt',
          mimeType: 'text/plain',
          size: '18 B',
          uploadDate: '30 May 2026',
          status: 'ready',
          sourcePath: '',
          extractedText: 'plain text content',
          summary: 'plain text content',
          totalPages: null,
        },
      ],
    };
    prismaMock.notebook.findUnique
      .mockResolvedValueOnce({ id: 'nb-1' })
      .mockResolvedValueOnce(returnedNotebook);
    prismaMock.notebook.update.mockImplementation(async ({ data }: { data: { files: { create: Record<string, unknown> } } }) => ({
      ...returnedNotebook,
      files: [
        {
          id: 'file-1',
          extractedText: data.files.create.extractedText,
          name: data.files.create.name,
          type: data.files.create.type,
          mimeType: data.files.create.mimeType,
          size: data.files.create.size,
          uploadDate: data.files.create.uploadDate,
          status: 'ready',
          sourcePath: data.files.create.sourcePath,
          summary: data.files.create.summary,
          totalPages: data.files.create.totalPages,
        },
      ],
    }));

    const formData = new FormData();
    formData.append('file', new File(['plain text content'], 'week-1.txt', { type: 'text/plain' }));

    const request = new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.notebook.files).toHaveLength(1);
    expect(payload.notebook.files[0].summary).toBe('plain text content');
    expect(prismaMock.notebook.update).toHaveBeenCalledTimes(1);

    const createdFileData = prismaMock.notebook.update.mock.calls[0][0].data.files.create;
    expect(createdFileData.summary).toBe('plain text content');

    const storedPath = createdFileData.sourcePath as string;
    const storedContent = await readFile(storedPath, 'utf8');
    expect(storedContent).toBe('plain text content');
    expect(indexNotebookFileForRag).toHaveBeenCalledWith(
      expect.objectContaining({
        extractedText: 'plain text content',
        fileId: 'file-1',
        notebookId: 'nb-1',
      }),
    );
  });

  it('persists the AI-generated summary in the notebook file row', async () => {
    process.env.CHAT_API_BASE_URL = 'https://chat.example.test/v1';
    process.env.CHAT_API_KEY = 'test-chat-key';
    process.env.CHAT_MODEL = 'study-summary-model';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: 'AI route summary for refetching.',
          },
        },
      ],
    }))));

    const returnedNotebook = {
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      files: [],
    };
    prismaMock.notebook.findUnique
      .mockResolvedValueOnce({ id: 'nb-1' })
      .mockResolvedValueOnce({
        ...returnedNotebook,
        files: [
          {
            id: 'file-1',
            name: 'week-1.txt',
            type: 'txt',
            mimeType: 'text/plain',
            size: '18 B',
            uploadDate: '30 May 2026',
            status: 'ready',
            sourcePath: 'stored-path',
            extractedText: 'plain text content',
            summary: 'AI route summary for refetching.',
            totalPages: null,
          },
        ],
      });
    prismaMock.notebook.update.mockImplementation(async ({ data }: { data: { files: { create: Record<string, unknown> } } }) => ({
      ...returnedNotebook,
      files: [
        {
          id: 'file-1',
          extractedText: data.files.create.extractedText,
          name: data.files.create.name,
          type: data.files.create.type,
          mimeType: data.files.create.mimeType,
          size: data.files.create.size,
          uploadDate: data.files.create.uploadDate,
          status: 'ready',
          sourcePath: data.files.create.sourcePath,
          summary: data.files.create.summary,
          totalPages: data.files.create.totalPages,
        },
      ],
    }));

    const formData = new FormData();
    formData.append('file', new File(['plain text content'], 'week-1.txt', { type: 'text/plain' }));

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(prismaMock.notebook.update.mock.calls[0][0].data.files.create.summary).toBe('AI route summary for refetching.');
    expect(payload.notebook.files[0].summary).toBe('AI route summary for refetching.');
  });

  it('removes the uploaded file row and stored file when indexing fails', async () => {
    prismaMock.notebook.findUnique.mockResolvedValueOnce({ id: 'nb-1' });
    prismaMock.notebook.update.mockImplementation(async ({ data }: { data: { files: { create: Record<string, unknown> } } }) => ({
      id: 'nb-1',
      name: 'Algorithms',
      courseCode: 'CS101',
      color: 'indigo',
      description: 'Notes',
      conceptCount: 4,
      files: [
        {
          id: 'file-1',
          extractedText: data.files.create.extractedText,
          name: data.files.create.name,
          type: data.files.create.type,
          mimeType: data.files.create.mimeType,
          size: data.files.create.size,
          uploadDate: data.files.create.uploadDate,
          status: 'ready',
          sourcePath: data.files.create.sourcePath,
          summary: data.files.create.summary,
          totalPages: data.files.create.totalPages,
        },
      ],
    }));
    prismaMock.notebookFile.delete.mockResolvedValue({ id: 'file-1' });
    vi.mocked(indexNotebookFileForRag).mockRejectedValue(new Error('embedding failed'));

    const formData = new FormData();
    formData.append('file', new File(['plain text content'], 'week-1.txt', { type: 'text/plain' }));

    const response = await POST(new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    }), {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatch(/index/i);
    expect(prismaMock.notebookFile.delete).toHaveBeenCalledWith({
      where: { id: 'file-1' },
    });

    const storedPath = prismaMock.notebook.update.mock.calls[0][0].data.files.create.sourcePath as string;
    await expect(readFile(storedPath, 'utf8')).rejects.toThrow();
  });

  it('rejects unsupported file types', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });

    const formData = new FormData();
    formData.append('file', new File(['binary'], 'archive.zip', { type: 'application/zip' }));

    const request = new Request('http://localhost/api/notebooks/nb-1/files', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/supported/i);
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });

  it('rejects oversize uploads', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({ id: 'nb-1' });

    const oversizedFile = new File(['x'], 'too-large.txt', { type: 'text/plain' });
    Object.defineProperty(oversizedFile, 'size', {
      value: MAX_UPLOAD_BYTES + 1,
      configurable: true,
    });

    const request = {
      formData: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(oversizedFile),
      }),
    } as unknown as Request;

    const response = await POST(request, {
      params: Promise.resolve({ notebookId: 'nb-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/100 MB/);
    expect(prismaMock.notebook.update).not.toHaveBeenCalled();
  });
});
