const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    notebookFile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/lib/file-summary', () => ({
  generateNotebookFileSummary: vi.fn(),
}));

import { generateAndStoreNotebookFileSummary } from './notebook-file-summary-job';
import { generateNotebookFileSummary } from './file-summary';

describe('generateAndStoreNotebookFileSummary', () => {
  beforeEach(() => {
    prismaMock.notebookFile.findUnique.mockReset();
    prismaMock.notebookFile.update.mockReset();
    vi.mocked(generateNotebookFileSummary).mockReset();
  });

  it('stores a completed summary status when generation succeeds', async () => {
    prismaMock.notebookFile.findUnique.mockResolvedValue({
      extractedText: 'Course material about architecture patterns.',
      id: 'file-1',
      name: 'patterns.pdf',
      type: 'pdf',
    });
    prismaMock.notebookFile.update.mockResolvedValue({});
    vi.mocked(generateNotebookFileSummary).mockResolvedValue('Generated summary.');

    await generateAndStoreNotebookFileSummary('file-1');

    expect(prismaMock.notebookFile.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'file-1' },
      data: {
        summary: null,
        summaryError: null,
        summaryGeneratedAt: null,
        summaryStatus: 'in-progress',
      },
    });
    expect(prismaMock.notebookFile.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'file-1' },
      data: expect.objectContaining({
        summary: 'Generated summary.',
        summaryError: null,
        summaryStatus: 'done',
      }),
    });
  });

  it('stores partial summary text while generation is in progress', async () => {
    prismaMock.notebookFile.findUnique.mockResolvedValue({
      extractedText: 'Course material about architecture patterns.',
      id: 'file-1',
      name: 'patterns.pdf',
      type: 'pdf',
    });
    prismaMock.notebookFile.update.mockResolvedValue({});
    vi.mocked(generateNotebookFileSummary).mockImplementation(async (params) => {
      await params.onDelta?.('Partial');
      await params.onDelta?.(' summary.');
      return 'Partial summary.';
    });

    await generateAndStoreNotebookFileSummary('file-1');

    expect(prismaMock.notebookFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        summary: 'Partial',
        summaryError: null,
        summaryGeneratedAt: null,
        summaryStatus: 'in-progress',
      },
    });
    expect(prismaMock.notebookFile.update).toHaveBeenLastCalledWith({
      where: { id: 'file-1' },
      data: expect.objectContaining({
        summary: 'Partial summary.',
        summaryError: null,
        summaryStatus: 'done',
      }),
    });
  });

  it('stores an error status when generation fails', async () => {
    prismaMock.notebookFile.findUnique.mockResolvedValue({
      extractedText: 'Course material about architecture patterns.',
      id: 'file-1',
      name: 'patterns.pdf',
      type: 'pdf',
    });
    prismaMock.notebookFile.update.mockResolvedValue({});
    vi.mocked(generateNotebookFileSummary).mockRejectedValue(new Error('provider timeout'));

    await generateAndStoreNotebookFileSummary('file-1');

    expect(prismaMock.notebookFile.update).toHaveBeenLastCalledWith({
      where: { id: 'file-1' },
      data: {
        summaryError: 'provider timeout',
        summaryGeneratedAt: null,
        summaryStatus: 'error',
      },
    });
  });
});
