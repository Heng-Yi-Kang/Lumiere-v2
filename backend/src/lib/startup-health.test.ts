import { createStartupHealthReport, pingChatProvider, pingEmbeddingProvider, pingSttProvider } from './startup-health';

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('startup health checks', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const healthyDeps = {
    ensureUploadRootWritable: vi.fn().mockResolvedValue(undefined),
    hasCommand: vi.fn().mockResolvedValue(true),
    pingChatProvider: vi.fn().mockResolvedValue(undefined),
    pingDatabase: vi.fn().mockResolvedValue(undefined),
    pingEmbeddingProvider: vi.fn().mockResolvedValue(undefined),
    pingQdrant: vi.fn().mockResolvedValue(undefined),
    pingRerankerProvider: vi.fn().mockResolvedValue(undefined),
    pingSttProvider: vi.fn().mockResolvedValue(undefined),
    pingVlmProvider: vi.fn().mockResolvedValue(undefined),
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fails when required startup dependencies are unavailable', async () => {
    setEnv('EMBEDDING_API_BASE', undefined);
    setEnv('EMBEDDING_API_KEY', undefined);
    setEnv('EMBEDDING_MODEL', undefined);
    setEnv('QDRANT_URL', undefined);
    setEnv('QDRANT_COLLECTION', undefined);
    setEnv('ENABLE_RERANKING', 'false');
    setEnv('CHAT_API_KEY', undefined);
    setEnv('CHAT_MODEL', undefined);
    setEnv('STT_API_BASE', undefined);
    setEnv('STT_API_KEY', undefined);
    setEnv('STT_MODEL', undefined);
    setEnv('VLM_API_KEY', undefined);
    setEnv('VLM_MODEL', undefined);

    const report = await createStartupHealthReport(healthyDeps);

    expect(report.status).toBe('failed');
    expect(report.errorCount).toBeGreaterThan(0);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'embeddings-config',
        status: 'error',
      }),
      expect.objectContaining({
        name: 'qdrant-config',
        status: 'error',
      }),
    ]));
  });

  it('reports degraded status when only optional capabilities are missing', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'embedding-model');
    setEnv('QDRANT_URL', 'http://localhost:6333');
    setEnv('QDRANT_COLLECTION', 'notebook_chunks');
    setEnv('ENABLE_RERANKING', 'false');
    setEnv('CHAT_API_KEY', undefined);
    setEnv('CHAT_MODEL', undefined);
    setEnv('STT_API_BASE', undefined);
    setEnv('STT_API_KEY', undefined);
    setEnv('STT_MODEL', undefined);
    setEnv('VLM_API_KEY', undefined);
    setEnv('VLM_MODEL', undefined);

    const report = await createStartupHealthReport(healthyDeps);

    expect(report.status).toBe('degraded');
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'chat-config',
        status: 'warn',
      }),
      expect.objectContaining({
        name: 'stt-config',
        status: 'warn',
      }),
      expect.objectContaining({
        name: 'video-vlm-config',
        status: 'warn',
      }),
    ]));
  });

  it('treats reranker misconfiguration as a startup error when enabled', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'embedding-model');
    setEnv('QDRANT_URL', 'http://localhost:6333');
    setEnv('QDRANT_COLLECTION', 'notebook_chunks');
    setEnv('ENABLE_RERANKING', 'true');
    setEnv('RERANKER_API_BASE', undefined);
    setEnv('RERANKER_API_KEY', undefined);
    setEnv('RERANKER_MODEL', undefined);
    setEnv('CHAT_API_KEY', 'chat-key');
    setEnv('CHAT_MODEL', 'chat-model');

    const report = await createStartupHealthReport(healthyDeps);

    expect(report.status).toBe('failed');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'reranker-config',
        status: 'error',
      }),
    ]));
  });

  it('fails startup when embeddings provider is unreachable', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'embedding-model');
    setEnv('QDRANT_URL', 'http://localhost:6333');
    setEnv('QDRANT_COLLECTION', 'notebook_chunks');
    setEnv('ENABLE_RERANKING', 'false');

    const report = await createStartupHealthReport({
      ...healthyDeps,
      pingEmbeddingProvider: vi.fn().mockRejectedValue(new Error('connection refused')),
    });

    expect(report.status).toBe('failed');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'embeddings-connectivity',
        status: 'error',
      }),
    ]));
  });

  it('degrades startup when optional chat provider is unreachable', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'embedding-model');
    setEnv('QDRANT_URL', 'http://localhost:6333');
    setEnv('QDRANT_COLLECTION', 'notebook_chunks');
    setEnv('ENABLE_RERANKING', 'false');
    setEnv('CHAT_API_KEY', 'chat-key');
    setEnv('CHAT_MODEL', 'chat-model');

    const report = await createStartupHealthReport({
      ...healthyDeps,
      pingChatProvider: vi.fn().mockRejectedValue(new Error('timeout')),
    });

    expect(report.status).toBe('degraded');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'chat-connectivity',
        status: 'warn',
      }),
    ]));
  });

  it('fails startup when enabled reranker is unreachable', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'embedding-model');
    setEnv('QDRANT_URL', 'http://localhost:6333');
    setEnv('QDRANT_COLLECTION', 'notebook_chunks');
    setEnv('ENABLE_RERANKING', 'true');
    setEnv('RERANKER_API_BASE', 'https://reranker.example.test/v1');
    setEnv('RERANKER_API_KEY', 'reranker-key');
    setEnv('RERANKER_MODEL', 'reranker-model');

    const report = await createStartupHealthReport({
      ...healthyDeps,
      pingRerankerProvider: vi.fn().mockRejectedValue(new Error('503 unavailable')),
    });

    expect(report.status).toBe('failed');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'reranker-connectivity',
        status: 'error',
      }),
    ]));
  });

  it('accepts reasoning-only chat provider probe responses', async () => {
    setEnv('CHAT_API_BASE_URL', 'https://chat.example.test/v1');
    setEnv('CHAT_API_KEY', 'chat-key');
    setEnv('CHAT_MODEL', 'reasoning-model');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          message: {
            reasoning: 'ok',
          },
        },
      ],
    })));

    await expect(pingChatProvider()).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://chat.example.test/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":64'),
      }),
    );
  });

  it('rejects embedding provider probes with mismatched dimensions', async () => {
    setEnv('EMBEDDING_API_BASE', 'https://embeddings.example.test/v1');
    setEnv('EMBEDDING_API_KEY', 'embedding-key');
    setEnv('EMBEDDING_MODEL', 'google/gemini-embedding-2');
    setEnv('EMBEDDING_DIMENSIONS', '3072');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          embedding: [0.1, 0.2, 0.3],
        },
      ],
    })));

    await expect(pingEmbeddingProvider()).rejects.toThrow('Embedding provider returned 3 dimensions, expected 3072.');
  });

  it('accepts successful STT probe responses with empty transcript text', async () => {
    setEnv('STT_API_BASE', 'https://stt.example.test/v1');
    setEnv('STT_API_KEY', 'stt-key');
    setEnv('STT_MODEL', 'stt-model');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '' })));

    await expect(pingSttProvider()).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://stt.example.test/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('accepts STT probe client errors caused by synthetic probe audio', async () => {
    setEnv('STT_API_BASE', 'https://stt.example.test/v1');
    setEnv('STT_API_KEY', 'stt-key');
    setEnv('STT_MODEL', 'stt-model');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: 'Failed to apply ASR processor',
      },
    }), { status: 400 }));

    await expect(pingSttProvider()).resolves.toBeUndefined();
  });

  it('rejects STT probe authentication failures', async () => {
    setEnv('STT_API_BASE', 'https://stt.example.test/v1');
    setEnv('STT_API_KEY', 'stt-key');
    setEnv('STT_MODEL', 'stt-model');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: 'invalid api key',
      },
    }), { status: 401 }));

    await expect(pingSttProvider()).rejects.toThrow('STT provider probe failed with 401');
  });
});
