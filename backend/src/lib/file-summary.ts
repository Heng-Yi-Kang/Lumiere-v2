import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { generateChatCompletionFromMessages, streamChatCompletionFromMessages } from '@/lib/openai-chat';
import { splitIntoRagChunks } from '@/lib/rag';

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
const DEFAULT_SUMMARY_REQUEST_TIMEOUT_MS = 180000;
const LOG_SNIPPET_CHARS = 280;
const SUMMARY_EXCERPT_SEPARATOR = '\n\n';

type SummarySource = {
  mode: 'chunk-sampled' | 'full-text';
  selectedChunkIndexes: number[];
  text: string;
  totalChunkCount: number;
};

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

function normalizeSummarySourceText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function buildExcerptText(chunks: string[], indexes: number[]) {
  return indexes
    .slice()
    .sort((a, b) => a - b)
    .map((index) => chunks[index])
    .filter(Boolean)
    .join(SUMMARY_EXCERPT_SEPARATOR)
    .trim();
}

function getEvenCoverageCandidateIndexes(totalChunks: number) {
  if (totalChunks <= 2) {
    return [];
  }

  const candidates: number[] = [];
  const queuedGaps = [{ end: totalChunks - 1, start: 0 }];
  const queuedIndexes = new Set([0, totalChunks - 1]);

  while (queuedGaps.length) {
    queuedGaps.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const gap = queuedGaps.shift();

    if (!gap || gap.end - gap.start <= 1) {
      continue;
    }

    const middle = Math.floor((gap.start + gap.end) / 2);
    if (!queuedIndexes.has(middle)) {
      candidates.push(middle);
      queuedIndexes.add(middle);
    }

    queuedGaps.push({ end: middle, start: gap.start }, { end: gap.end, start: middle });
  }

  return candidates;
}

export function buildSummarySource(text: string, maxChars = MAX_SUMMARY_SOURCE_CHARS): SummarySource {
  const sourceCharLimit = Math.max(1, Math.floor(maxChars));
  const normalizedText = normalizeSummarySourceText(text);

  if (!normalizedText || normalizedText.length <= sourceCharLimit) {
    return {
      mode: 'full-text',
      selectedChunkIndexes: [],
      text: normalizedText,
      totalChunkCount: normalizedText ? 1 : 0,
    };
  }

  const chunks = splitIntoRagChunks(text)
    .map((chunk) => normalizeSummarySourceText(chunk.content))
    .filter(Boolean);

  if (chunks.length <= 1) {
    return {
      mode: 'full-text',
      selectedChunkIndexes: chunks.length ? [0] : [],
      text: normalizedText.slice(0, sourceCharLimit),
      totalChunkCount: chunks.length,
    };
  }

  const selectedIndexes = new Set([0, chunks.length - 1]);
  const firstAndLastText = buildExcerptText(chunks, [...selectedIndexes]);

  if (firstAndLastText.length > sourceCharLimit) {
    const separatorBudget = SUMMARY_EXCERPT_SEPARATOR.length;
    const availableTextBudget = Math.max(0, sourceCharLimit - separatorBudget);
    const firstBudget = Math.floor(availableTextBudget / 2);
    const lastBudget = availableTextBudget - firstBudget;
    return {
      mode: 'chunk-sampled',
      selectedChunkIndexes: [0, chunks.length - 1],
      text: [
        firstBudget > 0 ? chunks[0]?.slice(0, firstBudget) : '',
        lastBudget > 0 ? chunks[chunks.length - 1]?.slice(-lastBudget) : '',
      ].filter(Boolean).join(SUMMARY_EXCERPT_SEPARATOR).trim(),
      totalChunkCount: chunks.length,
    };
  }

  for (const candidateIndex of getEvenCoverageCandidateIndexes(chunks.length)) {
    const candidateIndexes = [...selectedIndexes, candidateIndex];
    const candidateText = buildExcerptText(chunks, candidateIndexes);

    if (candidateText.length > sourceCharLimit) {
      continue;
    }

    selectedIndexes.add(candidateIndex);
  }

  return {
    mode: 'chunk-sampled',
    selectedChunkIndexes: [...selectedIndexes].sort((a, b) => a - b),
    text: buildExcerptText(chunks, [...selectedIndexes]).slice(0, sourceCharLimit),
    totalChunkCount: chunks.length,
  };
}

export async function generateNotebookFileSummary(params: {
  fileName: string;
  fileType: string;
  onDelta?: (text: string) => void | Promise<void>;
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

  const sourceText = buildSummarySource(params.text);
  if (!sourceText.text) {
    logBackendProcess('warn', 'file.summary.skipped', {
      fileName: params.fileName,
      fileType: params.fileType,
      reason: 'empty_extracted_text',
    });
    return undefined;
  }

  const baseUrl = getOptionalEnv('CHAT_API_BASE_URL') || 'https://api.openai.com/v1';
  const timeoutMs = getSummaryRequestTimeoutMs();
  const requestStartedAt = performance.now();

  logBackendProcess('info', 'file.summary.request.started', {
    fileName: params.fileName,
    fileType: params.fileType,
    model,
    providerHost: getProviderHost(baseUrl),
    selectedChunkIndexes: sourceText.selectedChunkIndexes.join(','),
    selectedTextChars: sourceText.text.length,
    sourceMode: sourceText.mode,
    sourceTextChars: normalizeSummarySourceText(params.text).length,
    timeoutMs,
    totalChunkCount: sourceText.totalChunkCount,
  });

  const messages = [
    {
      role: 'system' as const,
      content: [
        'You generate concise study summaries for uploaded course files.',
        'Use only the supplied extracted file text.',
        'For long files, the supplied text may contain representative excerpts sampled from across the file.',
        'Write 3 to 5 sentences focused on main ideas, likely study value, and key terms.',
        'Do not invent details that are not present in the text.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        `File name: ${params.fileName}`,
        `File type: ${params.fileType}`,
        '',
        'Extracted text:',
        sourceText.text,
      ].join('\n'),
    },
  ];

  try {
    const generated = params.onDelta
      ? await streamChatCompletionFromMessages({
          messages,
          onDelta: params.onDelta,
          timeoutMs,
        })
      : await generateChatCompletionFromMessages({
          messages,
          timeoutMs,
        });
    const summary = generated.replace(/\s+/g, ' ').trim() || undefined;

    if (!summary) {
      logBackendProcess('warn', 'file.summary.empty_response', {
        elapsedMs: getElapsedMs(requestStartedAt),
        fileName: params.fileName,
        fileType: params.fileType,
        model,
        providerHost: getProviderHost(baseUrl),
      });
      return undefined;
    }

    logBackendProcess('info', 'file.summary.request.completed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      fileName: params.fileName,
      fileType: params.fileType,
      model,
      providerHost: getProviderHost(baseUrl),
      summaryChars: summary.length,
    });

    return summary;
  } catch (error) {
    if (error instanceof Error && error.message === 'Chat provider returned no answer.') {
      logBackendProcess('warn', 'file.summary.empty_response', {
        elapsedMs: getElapsedMs(requestStartedAt),
        fileName: params.fileName,
        fileType: params.fileType,
        model,
        providerHost: getProviderHost(baseUrl),
      });
      return undefined;
    }

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
}
