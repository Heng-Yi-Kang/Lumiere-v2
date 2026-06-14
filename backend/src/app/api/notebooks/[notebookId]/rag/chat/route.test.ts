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

function ragSearchResult(params: {
  chunkIndex?: number;
  content: string;
  fileId?: string;
  fileName?: string;
  pageNumber?: number | null;
  score?: number;
  slideNumber?: number | null;
  timestampEnd?: number | null;
  timestampStart?: number | null;
}) {
  const score = params.score ?? 0.9;

  return {
    chunkIndex: params.chunkIndex ?? 0,
    content: params.content,
    fileId: params.fileId ?? 'file-1',
    fileName: params.fileName ?? 'week-1.txt',
    pageNumber: params.pageNumber,
    rerankScore: null,
    score,
    slideNumber: params.slideNumber,
    timestampEnd: params.timestampEnd,
    timestampStart: params.timestampStart,
    vectorScore: score,
  };
}

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
      ragSearchResult({
        content: 'Greedy algorithms choose local optima.',
        score: 0.92,
      }),
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
        excerpt: 'Greedy algorithms choose local optima.',
        locationLabel: 'Chunk 1',
        position: 'Chunk 1',
        chunkIndex: 0,
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
          pageNumber: undefined,
          rerankScore: null,
          score: 0.92,
          slideNumber: undefined,
          timestampEnd: undefined,
          timestampStart: undefined,
          vectorScore: 0.92,
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

  it('adds timestamp citation labels before other available locations', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'lecture.mp4' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      ragSearchResult({
        content: 'At this point, the lecturer explains Dijkstra relaxation.',
        fileName: 'lecture.mp4',
        pageNumber: 3,
        score: 0.94,
        slideNumber: 8,
        timestampEnd: 84.6,
        timestampStart: 65.2,
      }),
    ]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Where is relaxation explained?' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.citations[0]).toEqual(expect.objectContaining({
      excerpt: 'At this point, the lecturer explains Dijkstra relaxation.',
      locationLabel: '1:05-1:24',
      position: '1:05-1:24',
      type: 'timestamp',
    }));
  });

  it('uses page, slide, then chunk fallback citation labels', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [
        { extractedText: null, id: 'file-1', name: 'week-1.pdf' },
        { extractedText: null, id: 'file-2', name: 'week-2.pptx' },
        { extractedText: null, id: 'file-3', name: 'notes.txt' },
      ],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      ragSearchResult({
        content: 'Page evidence.',
        fileId: 'file-1',
        fileName: 'week-1.pdf',
        pageNumber: 12,
      }),
      ragSearchResult({
        chunkIndex: 4,
        content: 'Slide evidence.',
        fileId: 'file-2',
        fileName: 'week-2.pptx',
        slideNumber: 7,
      }),
      ragSearchResult({
        chunkIndex: 9,
        content: 'Chunk fallback evidence.',
        fileId: 'file-3',
        fileName: 'notes.txt',
      }),
    ]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Show citation labels' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.citations).toEqual([
      expect.objectContaining({ chunkIndex: 0, locationLabel: 'Page 12', position: 'Page 12' }),
      expect.objectContaining({ chunkIndex: 4, locationLabel: 'Slide 7', position: 'Slide 7' }),
      expect.objectContaining({ chunkIndex: 9, locationLabel: 'Chunk 10', position: 'Chunk 10' }),
    ]);
  });

  it('trims citation excerpts to a concise preview', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      ragSearchResult({
        content: `${'Dynamic programming recurrence '.repeat(12)}base case.`,
      }),
    ]);

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Explain DP' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );
    const payload = await response.json();

    expect(payload.citations[0].excerpt.length).toBeLessThanOrEqual(240);
    expect(payload.citations[0].excerpt).toMatch(/\.\.\.$/);
  });

  it('streams keepalive bytes before chat generation completes', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      ragSearchResult({
        content: 'Greedy algorithms choose local optima.',
        score: 0.92,
      }),
    ]);

    let resolveCompletion: (answer: string) => void = () => undefined;
    vi.mocked(generateChatCompletion).mockReturnValue(new Promise((resolve) => {
      resolveCompletion = resolve;
    }));

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat', {
        body: JSON.stringify({ question: 'Explain greedy algorithms' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const decoder = new TextDecoder();
    const firstChunk = await reader!.read();
    expect(decoder.decode(firstChunk.value)).toBe(' ');

    resolveCompletion('Slow grounded answer.');

    let remainingBody = '';
    while (true) {
      const chunk = await reader!.read();
      if (chunk.done) {
        break;
      }
      remainingBody += decoder.decode(chunk.value);
    }

    expect(JSON.parse(remainingBody.trim())).toEqual(expect.objectContaining({
      answer: 'Slow grounded answer.',
      grounded: true,
    }));
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
      ragSearchResult({
        content: 'First retrieved chunk.',
        fileId: 'file-1',
        fileName: 'week-1.txt',
        score: 0.95,
      }),
      ragSearchResult({
        content: 'Second retrieved chunk.',
        fileId: 'file-2',
        fileName: 'week-2.txt',
        score: 0.94,
      }),
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
      ragSearchResult({
        content: 'Scoped chunk.',
        score: 0.92,
      }),
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

  it('falls back to extracted text when RAG retrieval fails', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{
        extractedText: 'Fallback text still grounds the answer while vector search is unavailable.',
        id: 'file-1',
        name: 'week-1.txt',
      }],
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

    expect(response.status).toBe(200);
    expect(payload.grounded).toBe(true);
    expect(generateChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.stringContaining('Fallback text still grounds the answer'),
        scopeLabel: 'stored extracted text from file "week-1.txt" in notebook "Algorithms"',
      }),
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('streams a JSON error when chat generation fails after the response starts', async () => {
    prismaMock.notebook.findUnique.mockResolvedValue({
      files: [{ extractedText: null, id: 'file-1', name: 'week-1.txt' }],
      id: 'nb-1',
      name: 'Algorithms',
    });
    vi.mocked(retrieveNotebookRagContext).mockResolvedValue([
      ragSearchResult({
        content: 'Greedy algorithms choose local optima.',
        score: 0.92,
      }),
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

    expect(response.status).toBe(200);
    expect(payload.error).toBe('chat provider unavailable');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
