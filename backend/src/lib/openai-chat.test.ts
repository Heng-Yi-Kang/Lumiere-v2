import {
  parseChatCompletionStreamData,
  streamChatCompletionFromMessages,
} from './openai-chat';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function streamResponse(text: string) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  }));
}

describe('parseChatCompletionStreamData', () => {
  it('parses content deltas and done markers', () => {
    expect(parseChatCompletionStreamData(JSON.stringify({
      choices: [{ delta: { content: 'Hello' } }],
    }))).toEqual({ done: false, text: 'Hello' });
    expect(parseChatCompletionStreamData('[DONE]')).toEqual({ done: true, text: '' });
  });

  it('ignores empty and malformed chunks', () => {
    expect(parseChatCompletionStreamData('')).toEqual({ done: false, text: '' });
    expect(parseChatCompletionStreamData('{not-json')).toEqual({ done: false, text: '' });
    expect(parseChatCompletionStreamData(JSON.stringify({
      choices: [{ delta: {} }],
    }))).toEqual({ done: false, text: '' });
  });

  it('throws provider stream errors', () => {
    expect(() => parseChatCompletionStreamData(JSON.stringify({
      error: { message: 'provider unavailable' },
    }))).toThrow('provider unavailable');
  });
});

describe('streamChatCompletionFromMessages', () => {
  const originalChatApiBaseUrl = process.env.CHAT_API_BASE_URL;
  const originalChatApiKey = process.env.CHAT_API_KEY;
  const originalChatModel = process.env.CHAT_MODEL;

  beforeEach(() => {
    process.env.CHAT_API_BASE_URL = 'https://chat.example.test/v1';
    process.env.CHAT_API_KEY = 'test-chat-key';
    process.env.CHAT_MODEL = 'test-chat-model';
  });

  afterEach(() => {
    restoreEnv('CHAT_API_BASE_URL', originalChatApiBaseUrl);
    restoreEnv('CHAT_API_KEY', originalChatApiKey);
    restoreEnv('CHAT_MODEL', originalChatModel);
    vi.unstubAllGlobals();
  });

  it('streams deltas into the callback and returns the final answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"Hello "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"there"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'))));
    const deltas: string[] = [];

    const answer = await streamChatCompletionFromMessages({
      messages: [{ role: 'user', content: 'Question' }],
      onDelta: (text) => {
        deltas.push(text);
      },
    });

    expect(deltas).toEqual(['Hello ', 'there']);
    expect(answer).toBe('Hello there');
  });

  it('falls back to non-streaming completion when stream setup fails before output', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('stream unavailable', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'Fallback answer.' } }],
      })));
    vi.stubGlobal('fetch', fetchMock);
    const deltas: string[] = [];

    const answer = await streamChatCompletionFromMessages({
      messages: [{ role: 'user', content: 'Question' }],
      onDelta: (text) => {
        deltas.push(text);
      },
    });

    expect(answer).toBe('Fallback answer.');
    expect(deltas).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
