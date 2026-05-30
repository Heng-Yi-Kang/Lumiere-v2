type ChatCompletionMessage = {
  content?: string | null;
};

type ChatCompletionChoice = {
  message?: ChatCompletionMessage;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

export class ChatCompletionError extends Error {}

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

export function getChatModel() {
  return getRequiredEnv('CHAT_MODEL');
}

export async function generateChatCompletion(params: {
  context: string;
  question: string;
  scopeLabel: string;
}) {
  const apiKey = getRequiredEnv('CHAT_API_KEY');
  const baseUrl = process.env.CHAT_API_BASE_URL?.trim() || 'https://api.openai.com/v1';
  const model = getChatModel();

  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
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
      ],
    }),
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
