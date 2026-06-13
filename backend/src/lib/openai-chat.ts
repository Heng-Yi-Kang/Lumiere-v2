type ChatCompletionMessage = {
  content?: string | null;
};

type ChatCompletionRequestMessage = {
  content: string;
  role: 'system' | 'user' | 'assistant';
};

type ChatCompletionChoice = {
  message?: ChatCompletionMessage;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

type ChatCompletionStreamChoice = {
  delta?: {
    content?: string | null;
  };
};

type ChatCompletionStreamChunk = {
  choices?: ChatCompletionStreamChoice[];
  error?: {
    message?: string;
  };
};

export class ChatCompletionError extends Error {}

const DEFAULT_CHAT_COMPLETION_TIMEOUT_MS = 120_000;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ChatCompletionError(`${name} is required for grounded chat generation.`);
  }

  return value;
}

function buildChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

function getChatCompletionTimeoutMs() {
  const configuredTimeout = Number(process.env.CHAT_API_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_CHAT_COMPLETION_TIMEOUT_MS;
}

export function getChatModel() {
  return getRequiredEnv('CHAT_MODEL');
}

function buildGroundedChatMessages(params: {
  context: string;
  question: string;
  scopeLabel: string;
}): ChatCompletionRequestMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are Lumiere Study Buddy. Answer only from the provided grounded context.',
        'If the context does not contain enough evidence, say what is missing instead of guessing.',
        'Keep the answer practical for a student. Mention that the answer is grounded in the provided notebook material.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Grounding scope: ${params.scopeLabel}`,
        '',
        'Grounded context:',
        params.context,
        '',
        `Question: ${params.question}`,
      ].join('\n'),
    },
  ];
}

function getChatCompletionConfig(timeoutMsOverride?: number) {
  const apiKey = getRequiredEnv('CHAT_API_KEY');
  const baseUrl = process.env.CHAT_API_BASE_URL?.trim() || 'https://api.openai.com/v1';
  const model = getChatModel();
  const timeoutMs = timeoutMsOverride && timeoutMsOverride > 0
    ? timeoutMsOverride
    : getChatCompletionTimeoutMs();

  return {
    apiKey,
    model,
    timeoutMs,
    url: buildChatCompletionsUrl(baseUrl),
  };
}

async function fetchChatCompletion(params: {
  messages: ChatCompletionRequestMessage[];
  stream?: boolean;
  timeoutMs?: number;
}) {
  const config = getChatCompletionConfig(params.timeoutMs);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        stream: params.stream || undefined,
        temperature: 0.2,
        messages: params.messages,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ChatCompletionError(`Chat completion timed out after ${config.timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  return response;
}

export async function generateChatCompletionFromMessages(params: {
  messages: ChatCompletionRequestMessage[];
  timeoutMs?: number;
}) {
  const response = await fetchChatCompletion({
    messages: params.messages,
    timeoutMs: params.timeoutMs,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ChatCompletionError(`Chat completion failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const answer = payload.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new ChatCompletionError('Chat provider returned no answer.');
  }

  return answer;
}

export function parseChatCompletionStreamData(data: string) {
  if (!data.trim() || data.trim() === '[DONE]') {
    return {
      done: data.trim() === '[DONE]',
      text: '',
    };
  }

  let payload: ChatCompletionStreamChunk;
  try {
    payload = JSON.parse(data) as ChatCompletionStreamChunk;
  } catch {
    return {
      done: false,
      text: '',
    };
  }

  const providerError = payload.error?.message?.trim();
  if (providerError) {
    throw new ChatCompletionError(providerError);
  }

  return {
    done: false,
    text: payload.choices?.[0]?.delta?.content || '',
  };
}

export async function streamChatCompletionFromMessages(params: {
  messages: ChatCompletionRequestMessage[];
  onDelta: (text: string) => void | Promise<void>;
  timeoutMs?: number;
}) {
  let accumulated = '';

  try {
    const response = await fetchChatCompletion({
      messages: params.messages,
      stream: true,
      timeoutMs: params.timeoutMs,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ChatCompletionError(`Chat completion stream failed with ${response.status}: ${body || response.statusText}`);
    }

    if (!response.body) {
      throw new ChatCompletionError('Chat provider returned no stream body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }

        const parsed = parseChatCompletionStreamData(trimmed.slice(5).trim());
        if (parsed.done) {
          const answer = accumulated.trim();
          if (!answer) {
            throw new ChatCompletionError('Chat provider returned no answer.');
          }
          return answer;
        }

        if (parsed.text) {
          accumulated += parsed.text;
          await params.onDelta(parsed.text);
        }
      }

      if (done) {
        break;
      }
    }

    const answer = accumulated.trim();
    if (!answer) {
      throw new ChatCompletionError('Chat provider returned no answer.');
    }

    return answer;
  } catch (error) {
    if (accumulated.trim()) {
      throw error;
    }

    return generateChatCompletionFromMessages({
      messages: params.messages,
      timeoutMs: params.timeoutMs,
    });
  }
}

export async function generateChatCompletion(params: {
  context: string;
  question: string;
  scopeLabel: string;
}) {
  return generateChatCompletionFromMessages({
    messages: buildGroundedChatMessages(params),
  });
}

export async function streamChatCompletion(params: {
  context: string;
  onDelta: (text: string) => void | Promise<void>;
  question: string;
  scopeLabel: string;
}) {
  return streamChatCompletionFromMessages({
    messages: buildGroundedChatMessages(params),
    onDelta: params.onDelta,
  });
}
