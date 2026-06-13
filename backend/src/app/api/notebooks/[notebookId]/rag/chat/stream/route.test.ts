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
  streamChatCompletion: vi.fn(),
}));

import { streamChatCompletion } from '@/lib/openai-chat';
import { retrieveNotebookRagContext } from '@/lib/rag';
import { POST } from './route';

describe('POST /api/notebooks/[notebookId]/rag/chat/stream', () => {
  beforeEach(() => {
    prismaMock.notebook.findUnique.mockReset();
    vi.mocked(retrieveNotebookRagContext).mockReset();
    vi.mocked(streamChatCompletion).mockReset();
  });

  it('emits delta and done events with citations', async () => {
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
        rerankScore: null,
        score: 0.92,
        vectorScore: 0.92,
      },
    ]);
    vi.mocked(streamChatCompletion).mockImplementation(async (params) => {
      await params.onDelta('Grounded ');
      await params.onDelta('answer.');
      return 'Grounded answer.';
    });

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat/stream', {
        body: JSON.stringify({ question: 'Explain greedy algorithms' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(body).toContain('event: delta\ndata: {"text":"Grounded "}');
    expect(body).toContain('event: delta\ndata: {"text":"answer."}');
    expect(body).toContain('event: done');
    expect(body).toContain('"answer":"Grounded answer."');
    expect(body).toContain('"fileName":"week-1.txt"');
  });

  it('emits an error event when generation fails', async () => {
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
        rerankScore: null,
        score: 0.92,
        vectorScore: 0.92,
      },
    ]);
    vi.mocked(streamChatCompletion).mockRejectedValue(new Error('provider unavailable'));

    const response = await POST(
      new Request('http://localhost/api/notebooks/nb-1/rag/chat/stream', {
        body: JSON.stringify({ question: 'Explain greedy algorithms' }),
        method: 'POST',
      }),
      { params: Promise.resolve({ notebookId: 'nb-1' }) },
    );

    await expect(response.text()).resolves.toContain('event: error\ndata: {"error":"provider unavailable"}');
  });
});
