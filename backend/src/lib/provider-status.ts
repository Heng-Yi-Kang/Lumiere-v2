import {
  pingChatProvider,
  pingEmbeddingProvider,
  pingSttProvider,
  pingVlmProvider,
} from '@/lib/startup-health';

const PROVIDER_PROBE_TIMEOUT_MS = 10_000;

export type AiProviderKey = 'chat' | 'embedding' | 'stt' | 'vlm';
export type AiProviderLiveStatus = 'unknown' | 'checking' | 'live' | 'failed';

export type AiProviderStatus = {
  checkedAt?: string;
  configured: boolean;
  label: string;
  liveStatus: AiProviderLiveStatus;
  message?: string;
  missingEnv: string[];
  model: string | null;
};

export type AiProviderStatusMap = Record<AiProviderKey, AiProviderStatus>;

type ProviderConfig = {
  key: AiProviderKey;
  label: string;
  missingEnv: string[];
  model: string | null;
  probe: (timeoutMs?: number) => Promise<void>;
};

function getTrimmedEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function getFirstEnv(names: string[]) {
  return names.map(getTrimmedEnv).find(Boolean);
}

function getMissingEnv(names: string[]) {
  return names.filter((name) => !getTrimmedEnv(name));
}

function getVlmMissingEnv() {
  const hasApiKey = Boolean(getFirstEnv(['VLM_API_KEY', 'CHAT_API_KEY']));
  const hasModel = Boolean(getFirstEnv(['VLM_MODEL', 'CHAT_MODEL']));

  return [
    hasApiKey ? null : 'VLM_API_KEY or CHAT_API_KEY',
    hasModel ? null : 'VLM_MODEL or CHAT_MODEL',
  ].filter(Boolean) as string[];
}

function getProviderConfigs(): ProviderConfig[] {
  return [
    {
      key: 'chat',
      label: 'Chat',
      missingEnv: getMissingEnv(['CHAT_API_KEY', 'CHAT_MODEL']),
      model: getTrimmedEnv('CHAT_MODEL') || null,
      probe: pingChatProvider,
    },
    {
      key: 'embedding',
      label: 'Embedding',
      missingEnv: getMissingEnv(['EMBEDDING_API_BASE', 'EMBEDDING_API_KEY', 'EMBEDDING_MODEL']),
      model: getTrimmedEnv('EMBEDDING_MODEL') || null,
      probe: pingEmbeddingProvider,
    },
    {
      key: 'stt',
      label: 'STT',
      missingEnv: getMissingEnv(['STT_API_BASE', 'STT_API_KEY', 'STT_MODEL']),
      model: getTrimmedEnv('STT_MODEL') || null,
      probe: pingSttProvider,
    },
    {
      key: 'vlm',
      label: 'VLM',
      missingEnv: getVlmMissingEnv(),
      model: getFirstEnv(['VLM_MODEL', 'CHAT_MODEL']) || null,
      probe: pingVlmProvider,
    },
  ];
}

function buildProviderStatus(config: ProviderConfig): AiProviderStatus {
  return {
    configured: config.missingEnv.length === 0,
    label: config.label,
    liveStatus: 'unknown',
    missingEnv: config.missingEnv,
    model: config.model,
  };
}

export function buildProviderConfigStatuses(): AiProviderStatusMap {
  return Object.fromEntries(
    getProviderConfigs().map((config) => [config.key, buildProviderStatus(config)]),
  ) as AiProviderStatusMap;
}

function sanitizeProbeError(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'timeout';
  }

  const message = error instanceof Error ? error.message : String(error);

  if (/timeout|timed out|aborted/i.test(message)) {
    return 'timeout';
  }

  const statusMatch = message.match(/\b(?:failed with|status)\s+(\d{3})\b/i);
  if (statusMatch) {
    return `HTTP status ${statusMatch[1]}`;
  }

  if (/non-json|unexpected|returned no|no numeric vector|no message content/i.test(message)) {
    return 'invalid response';
  }

  return 'request failed';
}

export async function probeProviderStatuses(): Promise<AiProviderStatusMap> {
  const checkedAt = new Date().toISOString();
  const entries = await Promise.all(
    getProviderConfigs().map(async (config) => {
      const baseStatus = buildProviderStatus(config);

      if (!baseStatus.configured) {
        return [
          config.key,
          {
            ...baseStatus,
            checkedAt,
            liveStatus: 'failed',
            message: 'missing config',
          },
        ] as const;
      }

      try {
        await config.probe(PROVIDER_PROBE_TIMEOUT_MS);
        return [
          config.key,
          {
            ...baseStatus,
            checkedAt,
            liveStatus: 'live',
            message: 'live',
          },
        ] as const;
      } catch (error) {
        return [
          config.key,
          {
            ...baseStatus,
            checkedAt,
            liveStatus: 'failed',
            message: sanitizeProbeError(error),
          },
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as AiProviderStatusMap;
}
