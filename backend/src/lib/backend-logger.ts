type BackendLogLevel = 'debug' | 'info' | 'warn' | 'error';

type BackendLogFields = Record<string, boolean | number | string | null | undefined>;

const LEVEL_RANK: Record<BackendLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLogLevel(): BackendLogLevel {
  const value = process.env.BACKEND_LOG_LEVEL?.toLowerCase();

  if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
    return value;
  }

  return 'info';
}

function shouldLog(level: BackendLogLevel) {
  return LEVEL_RANK[level] >= LEVEL_RANK[getConfiguredLogLevel()];
}

function cleanFields(fields: BackendLogFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function logBackendProcess(
  level: BackendLogLevel,
  event: string,
  fields: BackendLogFields = {},
) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...cleanFields(fields),
  };

  const message = `[backend] ${event}`;

  if (level === 'error') {
    console.error(message, payload);
    return;
  }

  if (level === 'warn') {
    console.warn(message, payload);
    return;
  }

  console.info(message, payload);
}

export function getElapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}
