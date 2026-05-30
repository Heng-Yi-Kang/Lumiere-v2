import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

const envFiles = ['.env.local', '.env'];

for (const path of envFiles) {
  if (existsSync(path)) {
    loadDotenv({ path, override: false, quiet: true });
  }
}

const args = new Set(process.argv.slice(2));
const shouldRunChat = !args.has('--embeddings-only');
const shouldRunEmbeddings = !args.has('--chat-only');

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function timed(label, fn) {
  const start = performance.now();
  await fn();
  const elapsedMs = Math.round(performance.now() - start);
  console.log(`PASS ${label} (${elapsedMs}ms)`);
}

async function assertJsonResponse(response, label) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text || response.statusText}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON response.`);
  }
}

async function testChatConnection() {
  const apiKey = requireEnv('CHAT_API_KEY');
  const model = requireEnv('CHAT_MODEL');
  const baseUrl = process.env.CHAT_API_BASE_URL?.trim() || 'https://api.openai.com/v1';

  const response = await fetch(buildUrl(baseUrl, '/chat/completions'), {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: 'Connectivity test. Reply with exactly: ok',
        },
      ],
    }),
  });

  const payload = await assertJsonResponse(response, 'Chat completion');
  const answer = payload?.choices?.[0]?.message?.content;

  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('Chat completion returned no message content.');
  }
}

async function testEmbeddingConnection() {
  const apiKey = requireEnv('EMBEDDING_API_KEY');
  const model = requireEnv('EMBEDDING_MODEL');
  const baseUrl = requireEnv('EMBEDDING_API_BASE');

  const response = await fetch(buildUrl(baseUrl, '/embeddings'), {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: 'Lumiere embedding connectivity test',
    }),
  });

  const payload = await assertJsonResponse(response, 'Embedding request');
  const embedding = payload?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
    throw new Error('Embedding request returned no numeric vector.');
  }

  console.log(`Embedding dimensions: ${embedding.length}`);
}

async function main() {
  const tests = [];

  if (shouldRunChat) {
    tests.push(['Chat LLM', testChatConnection]);
  }

  if (shouldRunEmbeddings) {
    tests.push(['OpenAI-compatible embeddings', testEmbeddingConnection]);
  }

  if (tests.length === 0) {
    throw new Error('No LLM connection tests selected.');
  }

  for (const [label, fn] of tests) {
    await timed(label, fn);
  }
}

main().catch((error) => {
  console.error(`FAIL ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
