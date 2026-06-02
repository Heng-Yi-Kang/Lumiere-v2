import { streamingJsonResponse } from './http';

describe('streamingJsonResponse', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cleans up keepalive interval when the client cancels the stream', async () => {
    vi.useFakeTimers();

    const response = streamingJsonResponse(new Promise(() => undefined));
    const reader = response.body!.getReader();
    const firstChunk = await reader.read();

    expect(new TextDecoder().decode(firstChunk.value)).toBe(' ');

    await reader.cancel();

    expect(() => vi.advanceTimersByTime(30_000)).not.toThrow();
  });

  it('streams keepalive bytes before the final JSON payload', async () => {
    const response = streamingJsonResponse(Promise.resolve({ ok: true }));
    const payload = await response.text();

    expect(JSON.parse(payload.trim())).toEqual({ ok: true });
    expect(payload.startsWith(' ')).toBe(true);
  });
});
