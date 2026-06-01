const { logBackendProcessMock } = vi.hoisted(() => ({
  logBackendProcessMock: vi.fn(),
}));

vi.mock('@/lib/backend-logger', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backend-logger')>('@/lib/backend-logger');

  return {
    ...actual,
    logBackendProcess: logBackendProcessMock,
  };
});

import { generateNotebookFileSummary } from './file-summary';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe('generateNotebookFileSummary', () => {
  const originalChatApiBaseUrl = process.env.CHAT_API_BASE_URL;
  const originalChatApiKey = process.env.CHAT_API_KEY;
  const originalChatModel = process.env.CHAT_MODEL;

  beforeEach(() => {
    process.env.CHAT_API_BASE_URL = 'https://chat.example.test/v1';
    process.env.CHAT_API_KEY = 'test-chat-key';
    process.env.CHAT_MODEL = 'study-summary-model';
    logBackendProcessMock.mockReset();
  });

  afterEach(() => {
    restoreEnv('CHAT_API_BASE_URL', originalChatApiBaseUrl);
    restoreEnv('CHAT_API_KEY', originalChatApiKey);
    restoreEnv('CHAT_MODEL', originalChatModel);
    vi.unstubAllGlobals();
  });

  it('logs parsed response status and returns the summary', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Course file summary.',
          },
        },
      ],
    }), {
      headers: {
        'content-type': 'application/json',
      },
    })));

    const result = await generateNotebookFileSummary({
      fileName: 'logic.txt',
      fileType: 'txt',
      text: 'Truth tables and De Morgan laws.',
    });

    expect(result).toBe('Course file summary.');
    expect(logBackendProcessMock).toHaveBeenCalledWith(
      'info',
      'file.summary.response.received',
      expect.objectContaining({
        choiceCount: 1,
        contentType: 'application/json',
        firstChoiceFinishReason: 'stop',
        firstMessageContentChars: 'Course file summary.'.length,
        firstMessageContentSnippet: 'Course file summary.',
        parsedJson: true,
        status: 200,
      }),
    );
  });

  it('logs provider body snippets for non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: 'model is not available for this account',
      },
    }), {
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        'content-type': 'application/json',
      },
    })));

    await expect(generateNotebookFileSummary({
      fileName: 'logic.txt',
      fileType: 'txt',
      text: 'Truth tables and De Morgan laws.',
    })).rejects.toThrow('Summary generation failed with 429');

    expect(logBackendProcessMock).toHaveBeenCalledWith(
      'warn',
      'file.summary.request.failed',
      expect.objectContaining({
        bodySnippet: expect.stringContaining('model is not available'),
        contentType: 'application/json',
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );
  });

  it('logs parse failures for invalid JSON responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', {
      headers: {
        'content-type': 'text/plain',
      },
    })));

    await expect(generateNotebookFileSummary({
      fileName: 'logic.txt',
      fileType: 'txt',
      text: 'Truth tables and De Morgan laws.',
    })).rejects.toThrow();

    expect(logBackendProcessMock).toHaveBeenCalledWith(
      'warn',
      'file.summary.response.parse_failed',
      expect.objectContaining({
        bodySnippet: 'not-json',
        contentType: 'text/plain',
        status: 200,
      }),
    );
  });

  it('logs empty usable content and returns undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          finish_reason: 'length',
          message: {
            content: '   ',
          },
        },
      ],
    }))));

    const result = await generateNotebookFileSummary({
      fileName: 'logic.txt',
      fileType: 'txt',
      text: 'Truth tables and De Morgan laws.',
    });

    expect(result).toBeUndefined();
    expect(logBackendProcessMock).toHaveBeenCalledWith(
      'warn',
      'file.summary.empty_response',
      expect.objectContaining({
        choiceCount: 1,
        firstChoiceFinishReason: 'length',
        firstMessageContentChars: 3,
        responseBodySnippet: expect.stringContaining('"choices"'),
      }),
    );
  });
});
