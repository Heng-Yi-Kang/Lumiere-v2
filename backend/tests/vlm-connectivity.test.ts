import { existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
};

const envFiles = ['.env.local', '.env'];
const redPixelPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lb0V9wAAAABJRU5ErkJggg==';

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadDotenv({ path: envFile, override: false, quiet: true });
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for VLM connectivity testing.`);
  }

  return value;
}

function buildChatCompletionsUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

describe('VLM connectivity', () => {
  it('connects to the configured vision-capable chat model', async () => {
    const apiKey = requireEnv('CHAT_API_KEY');
    const model = requireEnv('CHAT_MODEL');
    const baseUrl = process.env.CHAT_API_BASE_URL?.trim() || 'https://api.openai.com/v1';

    const response = await fetch(buildChatCompletionsUrl(baseUrl), {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 128,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '/no_think\nConnectivity test. Describe the image in three words or fewer.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: redPixelPngDataUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    const body = await response.text();

    expect(response.ok, `VLM request failed with ${response.status}: ${body || response.statusText}`).toBe(true);

    const payload = JSON.parse(body) as ChatCompletionResponse;
    const message = payload.choices?.[0]?.message;
    const answer = message?.content?.trim() || message?.reasoning?.trim();

    expect(answer, 'VLM response did not include message content or reasoning output.').toBeTruthy();
  }, 45_000);
});
