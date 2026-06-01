import { getRerankerModel, isRerankingEnabled, rerankDocuments, RerankerError } from './reranker';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('reranker client', () => {
  const originalApiBase = process.env.RERANKER_API_BASE;
  const originalApiKey = process.env.RERANKER_API_KEY;
  const originalModel = process.env.RERANKER_MODEL;
  const originalEnabled = process.env.ENABLE_RERANKING;

  beforeEach(() => {
    process.env.RERANKER_API_BASE = 'https://reranker.example.test/v1/';
    process.env.RERANKER_API_KEY = 'test-reranker-key';
    process.env.RERANKER_MODEL = 'Qwen/Qwen3-Reranker-8B';
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    restoreEnv('RERANKER_API_BASE', originalApiBase);
    restoreEnv('RERANKER_API_KEY', originalApiKey);
    restoreEnv('RERANKER_MODEL', originalModel);
    restoreEnv('ENABLE_RERANKING', originalEnabled);
    vi.unstubAllGlobals();
  });

  it('only enables reranking with ENABLE_RERANKING=true', () => {
    process.env.ENABLE_RERANKING = 'true';
    expect(isRerankingEnabled()).toBe(true);

    process.env.ENABLE_RERANKING = 'TRUE';
    expect(isRerankingEnabled()).toBe(true);

    process.env.ENABLE_RERANKING = 'false';
    expect(isRerankingEnabled()).toBe(false);

    delete process.env.ENABLE_RERANKING;
    expect(isRerankingEnabled()).toBe(false);
  });

  it('sends query-document pairs to a HuggingFace-compatible rerank endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { index: 0, score: 0.25 },
      { index: 1, score: 0.75 },
    ])));
    vi.stubGlobal('fetch', fetchMock);

    const scores = await rerankDocuments({
      documents: ['first chunk', 'second chunk'],
      query: 'what matters?',
    });

    expect(scores).toEqual([0.25, 0.75]);
    expect(fetchMock).toHaveBeenCalledWith('https://reranker.example.test/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-reranker-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-Reranker-8B',
        query: 'what matters?',
        texts: ['first chunk', 'second chunk'],
        truncate: true,
      }),
    });
  });

  it('rejects incomplete reranker responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { index: 0, score: 0.25 },
    ]))));

    await expect(rerankDocuments({
      documents: ['first chunk', 'second chunk'],
      query: 'what matters?',
    })).rejects.toThrow(RerankerError);
  });

  it('requires reranker config when called', async () => {
    delete process.env.RERANKER_MODEL;

    expect(() => getRerankerModel()).toThrow(RerankerError);
    await expect(rerankDocuments({
      documents: ['first chunk'],
      query: 'what matters?',
    })).rejects.toThrow(RerankerError);
  });
});
