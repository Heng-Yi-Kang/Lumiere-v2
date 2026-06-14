const { authMock, startupHealthMock } = vi.hoisted(() => ({
  authMock: {
    getAuthenticatedUser: vi.fn(),
  },
  startupHealthMock: {
    pingChatProvider: vi.fn(),
    pingEmbeddingProvider: vi.fn(),
    pingSttProvider: vi.fn(),
    pingVlmProvider: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: authMock.getAuthenticatedUser,
}));

vi.mock('@/lib/startup-health', () => startupHealthMock);

import { GET } from './route';
import { POST as PROBE } from './probe/route';

const envKeys = [
  'CHAT_API_BASE_URL',
  'CHAT_API_KEY',
  'CHAT_MODEL',
  'EMBEDDING_API_BASE',
  'EMBEDDING_API_KEY',
  'EMBEDDING_MODEL',
  'STT_API_BASE',
  'STT_API_KEY',
  'STT_MODEL',
  'VLM_API_BASE',
  'VLM_API_BASE_URL',
  'VLM_API_KEY',
  'VLM_MODEL',
] as const;

function request(path: string) {
  return new Request(`http://localhost${path}`);
}

describe('/api/provider-status', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    for (const key of envKeys) {
      delete process.env[key];
    }

    authMock.getAuthenticatedUser.mockResolvedValue({
      id: 'user-1',
      role: 'USER',
    });
    startupHealthMock.pingChatProvider.mockReset();
    startupHealthMock.pingEmbeddingProvider.mockReset();
    startupHealthMock.pingSttProvider.mockReset();
    startupHealthMock.pingVlmProvider.mockReset();
  });

  afterAll(() => {
    for (const [key, value] of originalEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('rejects unauthenticated config status requests', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(request('/api/provider-status'));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
  });

  it('rejects unauthenticated live probe requests', async () => {
    authMock.getAuthenticatedUser.mockResolvedValue(null);

    const response = await PROBE(request('/api/provider-status/probe'));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('authentication required');
  });

  it('reports model names and config status without exposing provider secrets', async () => {
    process.env.CHAT_API_KEY = 'chat-secret';
    process.env.CHAT_MODEL = 'chat-model';
    process.env.EMBEDDING_API_BASE = 'https://embedding.example.test/v1';
    process.env.EMBEDDING_API_KEY = 'embedding-secret';
    process.env.EMBEDDING_MODEL = 'embedding-model';
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'stt-secret';
    process.env.STT_MODEL = 'stt-model';
    process.env.VLM_API_KEY = 'vlm-secret';
    process.env.VLM_MODEL = 'vlm-model';

    const response = await GET(request('/api/provider-status'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providers.chat).toEqual({
      configured: true,
      label: 'Chat',
      liveStatus: 'unknown',
      missingEnv: [],
      model: 'chat-model',
    });
    expect(payload.providers.embedding.model).toBe('embedding-model');
    expect(payload.providers.stt.model).toBe('stt-model');
    expect(payload.providers.vlm.model).toBe('vlm-model');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('reports missing configuration and falls VLM back to chat settings', async () => {
    process.env.CHAT_API_KEY = 'chat-secret';
    process.env.CHAT_MODEL = 'chat-model';
    process.env.EMBEDDING_MODEL = 'embedding-model';

    const response = await GET(request('/api/provider-status'));
    const payload = await response.json();

    expect(payload.providers.chat.configured).toBe(true);
    expect(payload.providers.embedding).toMatchObject({
      configured: false,
      model: 'embedding-model',
      missingEnv: ['EMBEDDING_API_BASE', 'EMBEDDING_API_KEY'],
    });
    expect(payload.providers.stt.configured).toBe(false);
    expect(payload.providers.vlm).toMatchObject({
      configured: true,
      model: 'chat-model',
      missingEnv: [],
    });
  });

  it('returns independent live probe results without failing the whole request', async () => {
    process.env.CHAT_API_KEY = 'chat-secret';
    process.env.CHAT_MODEL = 'chat-model';
    process.env.EMBEDDING_API_BASE = 'https://embedding.example.test/v1';
    process.env.EMBEDDING_API_KEY = 'embedding-secret';
    process.env.EMBEDDING_MODEL = 'embedding-model';
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'stt-secret';
    process.env.STT_MODEL = 'stt-model';
    process.env.VLM_API_KEY = 'vlm-secret';
    process.env.VLM_MODEL = 'vlm-model';
    startupHealthMock.pingChatProvider.mockResolvedValue(undefined);
    startupHealthMock.pingEmbeddingProvider.mockRejectedValue(new Error('Embedding provider probe failed with 503: raw upstream body'));
    startupHealthMock.pingSttProvider.mockResolvedValue(undefined);
    startupHealthMock.pingVlmProvider.mockRejectedValue(new Error('VLM provider probe returned non-JSON response.'));

    const response = await PROBE(request('/api/provider-status/probe'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providers.chat).toMatchObject({
      liveStatus: 'live',
      message: 'live',
    });
    expect(payload.providers.embedding).toMatchObject({
      liveStatus: 'failed',
      message: 'HTTP status 503',
    });
    expect(payload.providers.stt.liveStatus).toBe('live');
    expect(payload.providers.vlm).toMatchObject({
      liveStatus: 'failed',
      message: 'invalid response',
    });
    expect(payload.providers.chat.checkedAt).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toContain('raw upstream body');
  });

  it('sanitizes timeout and fetch failures', async () => {
    process.env.CHAT_API_KEY = 'chat-secret';
    process.env.CHAT_MODEL = 'chat-model';
    process.env.EMBEDDING_API_BASE = 'https://embedding.example.test/v1';
    process.env.EMBEDDING_API_KEY = 'embedding-secret';
    process.env.EMBEDDING_MODEL = 'embedding-model';
    startupHealthMock.pingChatProvider.mockRejectedValue(new Error('The operation timed out.'));
    startupHealthMock.pingEmbeddingProvider.mockRejectedValue(new TypeError('fetch failed: ENOTFOUND secret-host'));

    const response = await PROBE(request('/api/provider-status/probe'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.providers.chat.message).toBe('timeout');
    expect(payload.providers.embedding.message).toBe('request failed');
    expect(payload.providers.stt).toMatchObject({
      liveStatus: 'failed',
      message: 'missing config',
    });
    expect(JSON.stringify(payload)).not.toContain('secret-host');
  });

  it('uses a 10 second timeout for live probes', async () => {
    process.env.CHAT_API_KEY = 'chat-secret';
    process.env.CHAT_MODEL = 'chat-model';
    process.env.EMBEDDING_API_BASE = 'https://embedding.example.test/v1';
    process.env.EMBEDDING_API_KEY = 'embedding-secret';
    process.env.EMBEDDING_MODEL = 'embedding-model';
    process.env.STT_API_BASE = 'https://stt.example.test/v1';
    process.env.STT_API_KEY = 'stt-secret';
    process.env.STT_MODEL = 'stt-model';
    process.env.VLM_API_KEY = 'vlm-secret';
    process.env.VLM_MODEL = 'vlm-model';
    startupHealthMock.pingChatProvider.mockResolvedValue(undefined);
    startupHealthMock.pingEmbeddingProvider.mockResolvedValue(undefined);
    startupHealthMock.pingSttProvider.mockResolvedValue(undefined);
    startupHealthMock.pingVlmProvider.mockResolvedValue(undefined);

    await PROBE(request('/api/provider-status/probe'));

    expect(startupHealthMock.pingChatProvider).toHaveBeenCalledWith(10_000);
    expect(startupHealthMock.pingEmbeddingProvider).toHaveBeenCalledWith(10_000);
    expect(startupHealthMock.pingSttProvider).toHaveBeenCalledWith(10_000);
    expect(startupHealthMock.pingVlmProvider).toHaveBeenCalledWith(10_000);
  });
});
