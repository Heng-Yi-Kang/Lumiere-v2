import { buildSttRequest } from './stt';

describe('buildSttRequest', () => {
  const originalSttRequestFormat = process.env.STT_REQUEST_FORMAT;

  afterEach(() => {
    if (originalSttRequestFormat === undefined) {
      delete process.env.STT_REQUEST_FORMAT;
      return;
    }

    process.env.STT_REQUEST_FORMAT = originalSttRequestFormat;
  });

  it('uses multipart by default for OpenAI-compatible transcription providers', () => {
    delete process.env.STT_REQUEST_FORMAT;

    const request = buildSttRequest({
      apiKey: 'test-key',
      baseUrl: 'https://stt.example.test/v1',
      buffer: Buffer.from('audio-bytes'),
      fileName: 'lecture.wav',
      mimeType: 'audio/wav',
      model: 'stt-model',
    });

    expect(request.body).toBeInstanceOf(FormData);
    expect(request.headers).toEqual({
      Authorization: 'Bearer test-key',
    });
  });

  it('uses JSON base64 for OpenRouter transcription providers', () => {
    delete process.env.STT_REQUEST_FORMAT;

    const request = buildSttRequest({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      buffer: Buffer.from('audio-bytes'),
      fileName: 'lecture.wav',
      mimeType: 'audio/wav',
      model: 'qwen/qwen3-asr',
    });

    expect(request.headers).toEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(request.body as string)).toEqual({
      file: {
        data: Buffer.from('audio-bytes').toString('base64'),
        filename: 'lecture.wav',
        format: 'wav',
      },
      model: 'qwen/qwen3-asr',
    });
  });

  it('allows JSON request format to be configured explicitly', () => {
    process.env.STT_REQUEST_FORMAT = 'json';

    const request = buildSttRequest({
      apiKey: 'test-key',
      baseUrl: 'https://stt.example.test/v1',
      buffer: Buffer.from('audio-bytes'),
      fileName: 'lecture.webm',
      mimeType: 'video/webm',
      model: 'qwen3-asr-1.7b',
    });

    expect(request.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
    }));
    expect(JSON.parse(request.body as string).file).toEqual(expect.objectContaining({
      format: 'webm',
    }));
  });
});
