import { logBackendProcess } from '@/lib/backend-logger';
import { getNotebookUploadRoot } from '@/lib/notebook-upload-root';
import { prisma } from '@/lib/prisma';
import { isRerankingEnabled } from '@/lib/reranker';
import { buildSttRequest } from '@/lib/stt-request';

const STARTUP_HEALTH_PROMISE_KEY = '__lumiereStartupHealthPromise';
const DEFAULT_PROVIDER_TIMEOUT_MS = 15_000;
const redPixelPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mP8z8BQDwAFgwJ/lb0V9wAAAABJRU5ErkJggg==';
const tinyWavBase64 = 'UklGRlYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YTIAAAAAAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

type StartupHealthStatus = 'ok' | 'warn' | 'error';

export type StartupHealthCheck = {
  message: string;
  name: string;
  required: boolean;
  status: StartupHealthStatus;
};

export type StartupHealthReport = {
  checks: StartupHealthCheck[];
  errorCount: number;
  status: 'degraded' | 'failed' | 'ok';
  summary: string;
  warningCount: number;
};

type StartupHealthDeps = {
  ensureUploadRootWritable: () => Promise<void>;
  hasCommand: (command: string) => Promise<boolean>;
  pingChatProvider: () => Promise<void>;
  pingDatabase: () => Promise<void>;
  pingEmbeddingProvider: () => Promise<void>;
  pingQdrant: () => Promise<void>;
  pingRerankerProvider: () => Promise<void>;
  pingSttProvider: () => Promise<void>;
  pingVlmProvider: () => Promise<void>;
};

declare global {
  var __lumiereStartupHealthPromise: Promise<StartupHealthReport> | undefined;
}

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function buildUrl(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/+$/, '')}${pathname}`;
}

function importRuntimeModule<T>(specifier: string): Promise<T> {
  // Next instrumentation traces static Node built-in imports as client-resolved modules.
  return (new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<T>)(specifier);
}

function getProviderTimeoutMs() {
  const configuredTimeout = Number(process.env.STARTUP_HEALTH_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : DEFAULT_PROVIDER_TIMEOUT_MS;
}

async function parseJsonResponse(response: Response, label: string) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text || response.statusText}`);
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`${label} returned non-JSON response.`);
  }
}

function getMissingEnv(names: string[]) {
  return names.filter((name) => !getTrimmedEnv(name));
}

function getFirstEnv(names: string[]) {
  return names.map(getTrimmedEnv).find(Boolean);
}

function getVideoFrameProviderConfig() {
  return {
    apiKey: getFirstEnv(['VLM_API_KEY', 'CHAT_API_KEY']),
    baseUrl: getFirstEnv(['VLM_API_BASE_URL', 'VLM_API_BASE', 'CHAT_API_BASE_URL']) || 'https://api.openai.com/v1',
    model: getFirstEnv(['VLM_MODEL', 'CHAT_MODEL']),
  };
}

function formatMissingEnvMessage(missingEnv: string[]) {
  return `Missing environment variables: ${missingEnv.join(', ')}.`;
}

function buildCheck(params: {
  message: string;
  name: string;
  required: boolean;
  status: StartupHealthStatus;
}) {
  return {
    message: params.message,
    name: params.name,
    required: params.required,
    status: params.status,
  } satisfies StartupHealthCheck;
}

function buildEnvCheck(params: {
  message: string;
  name: string;
  required: boolean;
  vars: string[];
}) {
  const missingEnv = getMissingEnv(params.vars);

  if (!missingEnv.length) {
    return buildCheck({
      message: params.message,
      name: params.name,
      required: params.required,
      status: 'ok',
    });
  }

  return buildCheck({
    message: `${params.message} ${formatMissingEnvMessage(missingEnv)}`,
    name: params.name,
    required: params.required,
    status: params.required ? 'error' : 'warn',
  });
}

async function ensureUploadRootWritable() {
  const { constants: fsConstants, promises: fs } = await importRuntimeModule<typeof import('node:fs')>('node:fs');
  const uploadRoot = getNotebookUploadRoot();
  await fs.mkdir(uploadRoot, { recursive: true });
  await fs.access(uploadRoot, fsConstants.W_OK);
}

async function hasCommand(command: string) {
  const { constants: fsConstants, promises: fs } = await importRuntimeModule<typeof import('node:fs')>('node:fs');
  const pathEntries = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':').filter(Boolean);
  const executableExtensions = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const pathEntry of pathEntries) {
    for (const extension of executableExtensions) {
      const executablePath = `${pathEntry.replace(/[\\/]+$/, '')}/${command}${extension}`;

      try {
        await fs.access(executablePath, fsConstants.X_OK);
        return true;
      } catch {
        // Keep searching PATH.
      }
    }
  }

  return false;
}

async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

async function pingQdrant() {
  const headers = new Headers();
  const apiKey = getTrimmedEnv('QDRANT_API_KEY');

  if (apiKey) {
    headers.set('api-key', apiKey);
  }

  const payload = await parseJsonResponse(
    await fetch(buildUrl(getTrimmedEnv('QDRANT_URL')!, '/collections'), {
      method: 'GET',
      signal: AbortSignal.timeout(getProviderTimeoutMs()),
      headers,
    }),
    'Qdrant collections probe',
  );

  const collections = (payload.result as { collections?: unknown } | undefined)?.collections;

  if (!Array.isArray(collections)) {
    throw new Error('Qdrant returned an unexpected collections response.');
  }
}

async function pingEmbeddingProvider() {
  const response = await fetch(buildUrl(getTrimmedEnv('EMBEDDING_API_BASE')!, '/embeddings'), {
    method: 'POST',
    signal: AbortSignal.timeout(getProviderTimeoutMs()),
    headers: {
      Authorization: `Bearer ${getTrimmedEnv('EMBEDDING_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: 'Lumiere startup health embedding probe',
      model: getTrimmedEnv('EMBEDDING_MODEL')!,
    }),
  });

  const payload = await parseJsonResponse(response, 'Embedding provider probe');
  const embedding = (payload.data as Array<{ embedding?: unknown }> | undefined)?.[0]?.embedding;

  if (!Array.isArray(embedding) || !embedding.length || !embedding.every(Number.isFinite)) {
    throw new Error('Embedding provider returned no numeric vector.');
  }
}

async function pingChatProvider() {
  const response = await fetch(buildUrl(getTrimmedEnv('CHAT_API_BASE_URL') || 'https://api.openai.com/v1', '/chat/completions'), {
    method: 'POST',
    signal: AbortSignal.timeout(getProviderTimeoutMs()),
    headers: {
      Authorization: `Bearer ${getTrimmedEnv('CHAT_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: 16,
      model: getTrimmedEnv('CHAT_MODEL')!,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: 'Connectivity check. Reply with ok.',
        },
      ],
    }),
  });

  const payload = await parseJsonResponse(response, 'Chat provider probe');
  const content = (((payload.choices as Array<{ message?: { content?: unknown } }> | undefined)?.[0]?.message?.content) ?? '').toString().trim();

  if (!content) {
    throw new Error('Chat provider returned no message content.');
  }
}

async function pingSttProvider() {
  const baseUrl = getTrimmedEnv('STT_API_BASE')!;
  const request = buildSttRequest({
    apiKey: getTrimmedEnv('STT_API_KEY')!,
    baseUrl,
    buffer: Buffer.from(tinyWavBase64, 'base64'),
    fileName: 'startup-health.wav',
    mimeType: 'audio/wav',
    model: getTrimmedEnv('STT_MODEL')!,
  });

  const response = await fetch(buildUrl(baseUrl, '/audio/transcriptions'), {
    method: 'POST',
    signal: AbortSignal.timeout(getProviderTimeoutMs()),
    headers: request.headers,
    body: request.body,
  });

  const payload = await parseJsonResponse(response, 'STT provider probe');
  const text = (payload.text ?? '').toString().trim();

  if (!text) {
    throw new Error('STT provider returned no transcript text.');
  }
}

async function pingVlmProvider() {
  const config = getVideoFrameProviderConfig();
  const response = await fetch(buildUrl(config.baseUrl, '/chat/completions'), {
    method: 'POST',
    signal: AbortSignal.timeout(getProviderTimeoutMs()),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: 32,
      model: config.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Connectivity check. Describe this image in three words or fewer.',
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

  const payload = await parseJsonResponse(response, 'VLM provider probe');
  const firstChoice = (payload.choices as Array<{ message?: { content?: unknown; reasoning?: unknown } }> | undefined)?.[0];
  const answer = (firstChoice?.message?.content ?? firstChoice?.message?.reasoning ?? '').toString().trim();

  if (!answer) {
    throw new Error('VLM provider returned no message content.');
  }
}

async function pingRerankerProvider() {
  const response = await fetch(buildUrl(getTrimmedEnv('RERANKER_API_BASE')!, '/rerank'), {
    method: 'POST',
    signal: AbortSignal.timeout(getProviderTimeoutMs()),
    headers: {
      Authorization: `Bearer ${getTrimmedEnv('RERANKER_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getTrimmedEnv('RERANKER_MODEL')!,
      query: 'startup health probe',
      texts: ['first candidate', 'second candidate'],
      truncate: true,
    }),
  });

  const payload = await parseJsonResponse(response, 'Reranker provider probe');

  if (!Array.isArray(payload) || payload.length !== 2) {
    throw new Error('Reranker provider returned an unexpected response shape.');
  }
}

const defaultDeps: StartupHealthDeps = {
  ensureUploadRootWritable,
  hasCommand,
  pingChatProvider,
  pingDatabase,
  pingEmbeddingProvider,
  pingQdrant,
  pingRerankerProvider,
  pingSttProvider,
  pingVlmProvider,
};

async function buildConnectivityCheck(params: {
  action: () => Promise<void>;
  failurePrefix: string;
  name: string;
  required: boolean;
  successMessage: string;
}) {
  try {
    await params.action();
    return buildCheck({
      message: params.successMessage,
      name: params.name,
      required: params.required,
      status: 'ok',
    });
  } catch (error) {
    return buildCheck({
      message: `${params.failurePrefix} ${error instanceof Error ? error.message : 'Unknown error.'}`,
      name: params.name,
      required: params.required,
      status: params.required ? 'error' : 'warn',
    });
  }
}

export async function createStartupHealthReport(
  deps: StartupHealthDeps = defaultDeps,
): Promise<StartupHealthReport> {
  const checks: StartupHealthCheck[] = [];

  checks.push(await buildConnectivityCheck({
    action: deps.pingDatabase,
    failurePrefix: 'Database connectivity failed.',
    name: 'database',
    required: true,
    successMessage: 'Database connectivity is available.',
  }));

  checks.push(await buildConnectivityCheck({
    action: deps.ensureUploadRootWritable,
    failurePrefix: 'Upload storage is not writable.',
    name: 'upload-root',
    required: true,
    successMessage: `Upload storage is writable at ${getNotebookUploadRoot()}.`,
  }));

  checks.push(buildEnvCheck({
    message: 'Embeddings provider is configured.',
    name: 'embeddings-config',
    required: true,
    vars: ['EMBEDDING_API_BASE', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL'],
  }));
  if (checks.at(-1)?.status === 'ok') {
    checks.push(await buildConnectivityCheck({
      action: deps.pingEmbeddingProvider,
      failurePrefix: 'Embeddings provider connectivity failed.',
      name: 'embeddings-connectivity',
      required: true,
      successMessage: 'Embeddings provider connectivity is available.',
    }));
  }

  const qdrantConfigCheck = buildEnvCheck({
    message: 'Qdrant connection is configured.',
    name: 'qdrant-config',
    required: true,
    vars: ['QDRANT_URL', 'QDRANT_COLLECTION'],
  });
  checks.push(qdrantConfigCheck);

  if (qdrantConfigCheck.status === 'ok') {
    checks.push(await buildConnectivityCheck({
      action: deps.pingQdrant,
      failurePrefix: 'Qdrant connectivity failed.',
      name: 'qdrant-connectivity',
      required: true,
      successMessage: 'Qdrant connectivity is available.',
    }));
  }

  const chatConfigCheck = buildEnvCheck({
    message: 'Chat provider is configured for grounded answers and summaries.',
    name: 'chat-config',
    required: false,
    vars: ['CHAT_API_KEY', 'CHAT_MODEL'],
  });
  checks.push(chatConfigCheck);
  if (chatConfigCheck.status === 'ok') {
    checks.push(await buildConnectivityCheck({
      action: deps.pingChatProvider,
      failurePrefix: 'Chat provider connectivity failed.',
      name: 'chat-connectivity',
      required: false,
      successMessage: 'Chat provider connectivity is available.',
    }));
  }

  const sttConfigCheck = buildEnvCheck({
    message: 'Speech-to-text provider is configured for audio and video uploads.',
    name: 'stt-config',
    required: false,
    vars: ['STT_API_BASE', 'STT_API_KEY', 'STT_MODEL'],
  });
  checks.push(sttConfigCheck);
  if (sttConfigCheck.status === 'ok') {
    checks.push(await buildConnectivityCheck({
      action: deps.pingSttProvider,
      failurePrefix: 'Speech-to-text provider connectivity failed.',
      name: 'stt-connectivity',
      required: false,
      successMessage: 'Speech-to-text provider connectivity is available.',
    }));
  }

  const [hasFfmpeg, hasFfprobe] = await Promise.all([
    deps.hasCommand('ffmpeg'),
    deps.hasCommand('ffprobe'),
  ]);
  checks.push(
    hasFfmpeg && hasFfprobe
      ? buildCheck({
          message: 'Video processing commands ffmpeg and ffprobe are available.',
          name: 'video-commands',
          required: false,
          status: 'ok',
        })
      : buildCheck({
          message: `Video processing dependencies are incomplete. Missing commands: ${[
            !hasFfmpeg ? 'ffmpeg' : null,
            !hasFfprobe ? 'ffprobe' : null,
          ].filter(Boolean).join(', ')}.`,
          name: 'video-commands',
          required: false,
          status: 'warn',
        }),
  );

  const hasYtDlp = await deps.hasCommand('yt-dlp');
  checks.push(
    hasYtDlp
      ? buildCheck({
          message: 'YouTube ingestion command yt-dlp is available.',
          name: 'youtube-command',
          required: false,
          status: 'ok',
        })
      : buildCheck({
          message: 'YouTube ingestion is unavailable. Install yt-dlp to add public YouTube videos to notebooks.',
          name: 'youtube-command',
          required: false,
          status: 'warn',
        }),
  );

  const videoFrameConfig = getVideoFrameProviderConfig();
  const vlmConfigCheck =
    videoFrameConfig.apiKey && videoFrameConfig.model
      ? buildCheck({
          message: 'Video frame description provider is configured.',
          name: 'video-vlm-config',
          required: false,
          status: 'ok',
        })
      : buildCheck({
          message: 'Video frame description provider is not configured. Set VLM_API_KEY/VLM_MODEL or CHAT_API_KEY/CHAT_MODEL for video uploads.',
          name: 'video-vlm-config',
          required: false,
          status: 'warn',
        });
  checks.push(vlmConfigCheck);
  if (vlmConfigCheck.status === 'ok') {
    checks.push(await buildConnectivityCheck({
      action: deps.pingVlmProvider,
      failurePrefix: 'Video frame description provider connectivity failed.',
      name: 'video-vlm-connectivity',
      required: false,
      successMessage: 'Video frame description provider connectivity is available.',
    }));
  }

  if (isRerankingEnabled()) {
    const rerankerConfigCheck = buildEnvCheck({
      message: 'Reranker is enabled and configured.',
      name: 'reranker-config',
      required: true,
      vars: ['RERANKER_API_BASE', 'RERANKER_API_KEY', 'RERANKER_MODEL'],
    });
    checks.push(rerankerConfigCheck);
    if (rerankerConfigCheck.status === 'ok') {
      checks.push(await buildConnectivityCheck({
        action: deps.pingRerankerProvider,
        failurePrefix: 'Reranker provider connectivity failed.',
        name: 'reranker-connectivity',
        required: true,
        successMessage: 'Reranker provider connectivity is available.',
      }));
    }
  } else {
    checks.push(buildCheck({
      message: 'Reranker is disabled.',
      name: 'reranker-config',
      required: false,
      status: 'ok',
    }));
  }

  const errorCount = checks.filter((check) => check.status === 'error').length;
  const warningCount = checks.filter((check) => check.status === 'warn').length;
  const status = errorCount
    ? 'failed'
    : warningCount
      ? 'degraded'
      : 'ok';
  const failedChecks = checks
    .filter((check) => check.status === 'error')
    .map((check) => check.name);
  const warningChecks = checks
    .filter((check) => check.status === 'warn')
    .map((check) => check.name);
  const summary = failedChecks.length
    ? `Required startup checks failed: ${failedChecks.join(', ')}.`
    : warningChecks.length
      ? `Optional startup capabilities are unavailable: ${warningChecks.join(', ')}.`
      : 'All startup checks passed.';

  return {
    checks,
    errorCount,
    status,
    summary,
    warningCount,
  };
}

export async function runStartupHealthCheck(
  deps: StartupHealthDeps = defaultDeps,
) {
  const report = await createStartupHealthReport(deps);

  for (const check of report.checks) {
    if (check.status === 'ok') {
      continue;
    }

    logBackendProcess(check.status === 'error' ? 'error' : 'warn', 'startup.health.check', {
      check: check.name,
      message: check.message,
      required: check.required,
    });
  }

  logBackendProcess(
    report.status === 'failed'
      ? 'error'
      : report.status === 'degraded'
        ? 'warn'
        : 'info',
    'startup.health.completed',
    {
      errorCount: report.errorCount,
      status: report.status,
      summary: report.summary,
      warningCount: report.warningCount,
    },
  );

  if (report.status === 'failed') {
    throw new Error(report.summary);
  }

  return report;
}

export function runStartupHealthCheckOnce(
  deps: StartupHealthDeps = defaultDeps,
) {
  globalThis[STARTUP_HEALTH_PROMISE_KEY] ??= runStartupHealthCheck(deps);
  return globalThis[STARTUP_HEALTH_PROMISE_KEY];
}
