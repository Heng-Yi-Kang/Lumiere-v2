import { promises as fs } from 'node:fs';

const DEFAULT_VLM_TIMEOUT_MS = 45_000;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
};

export class VlmError extends Error {}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

export function getVlmProviderConfig() {
  return {
    apiKey: getOptionalEnv('VLM_API_KEY', 'CHAT_API_KEY'),
    baseUrl: getOptionalEnv('VLM_API_BASE_URL', 'VLM_API_BASE', 'CHAT_API_BASE_URL') || 'https://api.openai.com/v1',
    model: getOptionalEnv('VLM_MODEL', 'CHAT_MODEL'),
  };
}

export async function describeImageFile(params: {
  fileName: string;
  filePath: string;
  mimeType: string;
  prompt: string;
  maxTokens?: number;
}) {
  const { apiKey, baseUrl, model } = getVlmProviderConfig();

  if (!apiKey || !model) {
    throw new VlmError('VLM_API_KEY/CHAT_API_KEY and VLM_MODEL/CHAT_MODEL are required for image description.');
  }

  const image = await fs.readFile(params.filePath);
  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    signal: AbortSignal.timeout(getPositiveNumberEnv('VLM_TIMEOUT_MS', DEFAULT_VLM_TIMEOUT_MS)),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: params.maxTokens ?? 400,
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: params.prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${params.mimeType};base64,${image.toString('base64')}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new VlmError(`Image description failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const answer = payload.choices?.[0]?.message?.content?.trim() || payload.choices?.[0]?.message?.reasoning?.trim();

  if (!answer) {
    throw new VlmError('VLM provider returned no image description.');
  }

  return answer;
}
