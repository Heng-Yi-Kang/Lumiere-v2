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

import { buildSummarySource, generateNotebookFileSummary } from './file-summary';

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function buildLargeSourceText(sectionCount = 24) {
  return Array.from({ length: sectionCount }, (_, index) => [
    `# Section ${index}`,
    Array.from({ length: 140 }, (__, wordIndex) => `section-${index}-term-${wordIndex}`).join(' '),
  ].join('\n')).join('\n\n');
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

  it('keeps short summary sources as normalized full text', () => {
    const result = buildSummarySource('  Truth tables\n\nand\tDe Morgan laws.  ');

    expect(result).toEqual({
      mode: 'full-text',
      selectedChunkIndexes: [],
      text: 'Truth tables and De Morgan laws.',
      totalChunkCount: 1,
    });
  });

  it('samples large summary sources across the full file within the character budget', () => {
    const result = buildSummarySource(buildLargeSourceText());

    expect(result.mode).toBe('chunk-sampled');
    expect(result.text.length).toBeLessThanOrEqual(12000);
    expect(result.totalChunkCount).toBeGreaterThan(2);
    expect(result.selectedChunkIndexes[0]).toBe(0);
    expect(result.selectedChunkIndexes.at(-1)).toBe(result.totalChunkCount - 1);
    expect(result.text).toContain('Section 0');
    expect(result.text).toContain('Section 23');
    expect(result.text).toMatch(/Section (?:8|9|10|11|12|13|14|15)/);
  });

  it('uses selected chunks instead of first-only truncation in the provider request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Course file summary.',
          },
        },
      ],
    })));
    vi.stubGlobal('fetch', fetchMock);

    await generateNotebookFileSummary({
      fileName: 'large-notes.pdf',
      fileType: 'pdf',
      text: buildLargeSourceText(),
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: Array<{ content: string; role: string }>;
    };
    const userMessage = requestBody.messages.find((message) => message.role === 'user')?.content || '';
    const systemMessage = requestBody.messages.find((message) => message.role === 'system')?.content || '';

    expect(systemMessage).toContain('representative excerpts sampled from across the file');
    expect(userMessage).toContain('Section 0');
    expect(userMessage).toContain('Section 23');
    expect(userMessage.length).toBeLessThan(12500);
    expect(logBackendProcessMock).toHaveBeenCalledWith(
      'info',
      'file.summary.request.started',
      expect.objectContaining({
        sourceMode: 'chunk-sampled',
        totalChunkCount: expect.any(Number),
      }),
    );
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
