type ChatCompletionMessage = {
  content?: string | null;
};

type ChatCompletionChoice = {
  message?: ChatCompletionMessage;
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

const MAX_SUMMARY_SOURCE_CHARS = 12000;
const SUMMARY_REQUEST_TIMEOUT_MS = 15000;

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function buildChatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/chat/completions`;
}

export async function generateNotebookFileSummary(params: {
  fileName: string;
  fileType: string;
  text: string;
}) {
  const apiKey = getOptionalEnv('CHAT_API_KEY');
  const model = getOptionalEnv('CHAT_MODEL');

  if (!apiKey || !model) {
    return undefined;
  }

  const sourceText = params.text.replace(/\s+/g, ' ').trim();
  if (!sourceText) {
    return undefined;
  }

  const baseUrl = getOptionalEnv('CHAT_API_BASE_URL') || 'https://api.openai.com/v1';
  const clippedText = sourceText.slice(0, MAX_SUMMARY_SOURCE_CHARS);

  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    signal: AbortSignal.timeout(SUMMARY_REQUEST_TIMEOUT_MS),
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

  if (!response.ok) {
    throw new Error(`Summary generation failed with ${response.status}: ${response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  return payload.choices?.[0]?.message?.content?.replace(/\s+/g, ' ').trim() || undefined;
}
