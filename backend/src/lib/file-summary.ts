import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';

type ChatCompletionMessage = {
  content?: string | null;
};

type ChatCompletionChoice = {
  finish_reason?: string | null;
  message?: ChatCompletionMessage;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

const MAX_SUMMARY_SOURCE_CHARS = 12000;
const DEFAULT_SUMMARY_REQUEST_TIMEOUT_MS = 90000;
const LOG_SNIPPET_CHARS = 280;

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function buildChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

function getProviderHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'invalid_url';
  }
}

function getSummaryRequestTimeoutMs() {
  const value = Number.parseInt(process.env.SUMMARY_REQUEST_TIMEOUT_MS || '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SUMMARY_REQUEST_TIMEOUT_MS;
}

function buildLogSnippet(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > LOG_SNIPPET_CHARS
    ? `${normalized.slice(0, LOG_SNIPPET_CHARS)}...`
    : normalized;
}

function parseChatCompletionPayload(text: string) {
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text) as ChatCompletionResponse;
}

export async function generateNotebookFileSummary(params: {
  fileName: string;
  fileType: string;
  text: string;
}) {
  const apiKey = getOptionalEnv('CHAT_API_KEY');
  const model = getOptionalEnv('CHAT_MODEL');

  if (!apiKey || !model) {
    logBackendProcess('warn', 'file.summary.skipped', {
      fileName: params.fileName,
      fileType: params.fileType,
      missingChatApiKey: !apiKey,
      missingChatModel: !model,
      reason: 'missing_chat_config',
    });
    return undefined;
  }

  const sourceText = params.text.replace(/\s+/g, ' ').trim();
  if (!sourceText) {
    logBackendProcess('warn', 'file.summary.skipped', {
      fileName: params.fileName,
      fileType: params.fileType,
      reason: 'empty_extracted_text',
    });
    return undefined;
  }

  const baseUrl = getOptionalEnv('CHAT_API_BASE_URL') || 'https://api.openai.com/v1';
  const clippedText = sourceText.slice(0, MAX_SUMMARY_SOURCE_CHARS);
  const timeoutMs = getSummaryRequestTimeoutMs();
  const requestStartedAt = performance.now();

  logBackendProcess('info', 'file.summary.request.started', {
    clippedTextChars: clippedText.length,
    fileName: params.fileName,
    fileType: params.fileType,
    model,
    providerHost: getProviderHost(baseUrl),
    sourceTextChars: sourceText.length,
    timeoutMs,
  });

  let response: Response;
  try {
    response = await fetch(buildChatCompletionsUrl(baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: [
              'You generate concise study summaries for uploaded course files.',
              'Use only the supplied extracted file text.',
              'Write 3 to 5 sentences focused on main ideas, likely study value, and key terms.',
              'Do not invent details that are not present in the text.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `File name: ${params.fileName}`,
              `File type: ${params.fileType}`,
              '',
              'Extracted text:',
              clippedText,
            ].join('\n'),
          },
        ],
      }),
    });
  } catch (error) {
    logBackendProcess('error', 'file.summary.request.failed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      error: error instanceof Error ? error.message : 'Unknown summary request error',
      fileName: params.fileName,
      fileType: params.fileType,
      model,
      providerHost: getProviderHost(baseUrl),
    });
    throw error;
  }

  const responseText = await response.text();
  let payload: ChatCompletionResponse | undefined;
  let parseError: Error | undefined;

  try {
    payload = parseChatCompletionPayload(responseText);
  } catch (error) {
    parseError = error instanceof Error ? error : new Error('Unknown JSON parse error');
  }

  const firstChoice = payload?.choices?.[0];
  const firstMessageContent = firstChoice?.message?.content;
  const responseLogFields = {
    bodyChars: responseText.length,
    bodySnippet: buildLogSnippet(responseText),
    choiceCount: payload?.choices?.length || 0,
    contentType: response.headers.get('content-type'),
    elapsedMs: getElapsedMs(requestStartedAt),
    fileName: params.fileName,
    fileType: params.fileType,
    firstChoiceFinishReason: firstChoice?.finish_reason,
    firstMessageContentChars: firstMessageContent?.length || 0,
    firstMessageContentSnippet: buildLogSnippet(firstMessageContent),
    model,
    parsedJson: Boolean(payload),
    providerHost: getProviderHost(baseUrl),
    status: response.status,
    statusText: response.statusText,
  };

  logBackendProcess(response.ok ? 'info' : 'warn', 'file.summary.response.received', responseLogFields);

  if (!response.ok) {
    logBackendProcess('warn', 'file.summary.request.failed', {
      bodyChars: responseText.length,
      bodySnippet: buildLogSnippet(responseText),
      contentType: response.headers.get('content-type'),
      elapsedMs: responseLogFields.elapsedMs,
      fileName: params.fileName,
      fileType: params.fileType,
      model,
      providerHost: getProviderHost(baseUrl),
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Summary generation failed with ${response.status}: ${response.statusText}`);
  }

  if (parseError || !payload) {
    logBackendProcess('warn', 'file.summary.response.parse_failed', {
      bodyChars: responseText.length,
      bodySnippet: buildLogSnippet(responseText),
      contentType: response.headers.get('content-type'),
      elapsedMs: responseLogFields.elapsedMs,
      error: parseError?.message || 'Empty response body',
      fileName: params.fileName,
      fileType: params.fileType,
      model,
      providerHost: getProviderHost(baseUrl),
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(parseError?.message || 'Summary provider returned an empty response body.');
  }

  const summary = payload.choices?.[0]?.message?.content?.replace(/\s+/g, ' ').trim() || undefined;

  if (!summary) {
    logBackendProcess('warn', 'file.summary.empty_response', {
      choiceCount: payload.choices?.length || 0,
      elapsedMs: responseLogFields.elapsedMs,
      fileName: params.fileName,
      fileType: params.fileType,
      firstChoiceFinishReason: firstChoice?.finish_reason,
      firstMessageContentChars: firstMessageContent?.length || 0,
      responseBodySnippet: buildLogSnippet(responseText),
      model,
      providerHost: getProviderHost(baseUrl),
    });
    return undefined;
  }

  logBackendProcess('info', 'file.summary.request.completed', {
    elapsedMs: responseLogFields.elapsedMs,
    fileName: params.fileName,
    fileType: params.fileType,
    model,
    providerHost: getProviderHost(baseUrl),
    summaryChars: summary.length,
  });

  return summary;
}
