const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebook: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/rag', () => ({
  diversifyRagResults: vi.fn((results: Array<{ content: string }>) => results.slice(0, 6)),
  formatRagContextForPrompt: vi.fn((results: Array<{ content: string }>) =>
    results.map((result) => result.content).join('\n\n'),
  ),
  retrieveNotebookRagContext: vi.fn(),
  splitIntoChunks: vi.fn((text: string) => text.trim() ? [text.trim()] : []),
}));

vi.mock('@/lib/openai-chat', () => ({
  generateChatCompletion: vi.fn().mockResolvedValue('Grounded answer from model.'),
}));

import { generateChatCompletion } from '@/lib/openai-chat';
import { diversifyRagResults, formatRagContextForPrompt, retrieveNotebookRagContext } from '@/lib/rag';
import { POST } from './route';

describe('POST /api/notebooks/[notebookId]/rag/chat', () => {
  beforeEach(() => {
    prismaMock.notebook.findUnique.mockReset();
    vi.mocked(diversifyRagResults).mockReset();
    vi.mocked(diversifyRagResults).mockImplementation((results) => results.slice(0, 6));
    vi.mocked(formatRagContextForPrompt).mockClear();
    vi.mocked(retrieveNotebookRagContext).mockReset();
    vi.mocked(generateChatCompletion).mockReset();
    vi.mocked(generateChatCompletion).mockResolvedValue('Grounded answer from model.');
  });

  it('returns no grounded context when the notebook has no files', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [],
      id: 'nb-1',
      name: 'Algorithms',
    });

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Explain this notebook' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.grounded).toBe(false);
    expect(payload.answer).toContain('No grounded context');
    expect(retrieveNotebookRagContext).not.toHaveBeenCalled();
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });

  it('returns no grounded context when indexed chunks are unavailable', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ fileId: 'file-1', question: 'Explain this file' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.grounded).toBe(false);
    expect(payload.scope.fileId).toBe('file-1');
    expect(generateChatCompletion).not.toHaveBeenCalled();
  });

  it('generates a grounded answer from retrieved notebook chunks', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      {
        chunkIndex: 0,
        content: 'Greedy algorithms choose local optima.',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.92,
      },
    ]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Explain greedy algorithms' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.grounded).toBe(true);
    expect(payload.answer).toBe('Grounded answer from model.');
    expect(payload.citations).toEqual([
      expect.objectContaining({
        fileId: 'file-1',
        fileName: 'week-1.txt',
        position: 'Chunk 1',
      }),
    ]);
    expect(generateChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Explain greedy algorithms',
        scopeLabel: 'all indexed files in notebook "Algorithms"',
      }),
    );
    expect(retrieveNotebookRagContext).toHaveBeenCalledWith(expect.objectContaining({
      limit: 20,
      notebookId: 'nb-1',
      query: 'Explain greedy algorithms',
    }));
    expect(diversifyRagResults).toHaveBeenCalledWith(
      [
        {
          chunkIndex: 0,
          content: 'Greedy algorithms choose local optima.',
          fileId: 'file-1',
          fileName: 'week-1.txt',
          score: 0.92,
        },
      ],
      {
        maxChunks: 6,
        maxChunksPerFile: 3,
        preserveTopN: 1,
        scoreTolerance: 0.03,
      },
    );
  });

  it('sends diversified notebook chunks to chat formatting', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [
        { extractedText: null, id: 'file-1', name: 'week-1.txt' },
        { extractedText: null, id: 'file-2', name: 'week-2.txt' },
      ],
      id: 'nb-1',
      name: 'Algorithms',
    });
    const retrievedResults = [
      {
        chunkIndex: 0,
        content: 'First retrieved chunk.',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.95,
      },
      {
        chunkIndex: 0,
        content: 'Second retrieved chunk.',
        fileId: 'file-2',
        fileName: 'week-2.txt',
        score: 0.94,
      },
    ];
    const diversifiedResults = [retrievedResults[1]];
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue(retrievedResults);
    vi.mocked(diversifyRagResults).mockReturnValue(diversifiedResults);

    await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Compare the weeks' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    expect(formatRagContextForPrompt).toHaveBeenCalledWith(diversifiedResults);
    expect(generateChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'Second retrieved chunk.',
      }),
    );
  });

  it('bypasses diversification when chat is scoped to one file', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    const retrievedResults = [
      {
        chunkIndex: 0,
        content: 'Scoped chunk.',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.92,
      },
    ];
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue(retrievedResults);

    await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ fileId: 'file-1', question: 'Explain this file' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    expect(retrieveNotebookRagContext).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'file-1',
      limit: 6,
    }));
    expect(diversifyRagResults).not.toHaveBeenCalled();
    expect(formatRagContextForPrompt).toHaveBeenCalledWith(retrievedResults);
  });

  it('falls back to extracted file text when indexed chunks are missing', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [
        {
          extractedText: 'Local search is unavailable, but this uploaded text can still ground the answer.',
          id: 'file-1',
          name: 'week-1.txt',
        },
      ],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'What does the file say?' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.grounded).toBe(true);
    expect(payload.citations).toEqual([
      expect.objectContaining({
        fileId: 'file-1',
        fileName: 'week-1.txt',
        position: 'Chunk 1',
      }),
    ]);
    expect(generateChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining('this uploaded text can still ground the answer'),
        scopeLabel: 'stored extracted text from notebook "Algorithms"',
      }),
    );
  });

  it('diversifies extracted text fallback for notebook-wide chat', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [
        {
          extractedText: 'Week one fallback text.',
          id: 'file-1',
          name: 'week-1.txt',
        },
        {
          extractedText: 'Week two fallback text.',
          id: 'file-2',
          name: 'week-2.txt',
        },
      ],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([]);
    vi.mocked(diversifyRagResults).mockImplementation((results) => [results[1]]);

    await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'What does the notebook say?' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    expect(diversifyRagResults).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ fileId: 'file-1', score: 1 }),
        expect.objectContaining({ fileId: 'file-2', score: 1 }),
      ]),
      expect.objectContaining({ maxChunks: 6, maxChunksPerFile: 3 }),
    );
    expect(generateChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'Week two fallback text.',
        scopeLabel: 'stored extracted text from notebook "Algorithms"',
      }),
    );
  });

  it('returns a JSON error when RAG retrieval fails', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockRejectedValue(new Error('vector store unavailable'));

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ fileId: 'file-1', question: 'Explain this file' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe('vector store unavailable');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('returns a JSON error when chat generation fails', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      {
        chunkIndex: 0,
        content: 'Greedy algorithms choose local optima.',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.92,
      },
    ]);
    vi.mocked(generateChatCompletion).mockRejectedValue(new Error('chat provider unavailable'));

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ fileId: 'file-1', question: 'Explain this file' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe('chat provider unavailable');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
