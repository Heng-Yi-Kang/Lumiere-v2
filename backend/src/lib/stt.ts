import { promises as fs } from 'fs';

type SttResponse = {
  text?: string;
};

type SttRequest = {
  body: BodyInit;
  headers: Record<string, string>;
};

type SttRequestFormat = 'json' | 'multipart';

export class SttError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new SttError(`${name} is required for audio transcription.`);
  }

  return value;
}

function buildTranscriptionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/audio/transcriptions`;
}

function getConfiguredRequestFormat(baseUrl: string): SttRequestFormat {
  const configured = process.env.STT_REQUEST_FORMAT?.trim().toLowerCase();

  if (configured === 'json' || configured === 'multipart') {
    return configured;
  }

  if (baseUrl.includes('openrouter.ai')) {
    return 'json';
  }

  return 'multipart';
}

function getAudioFormat(fileName: string, mimeType: string) {
  const extension = fileName.split('.').pop()?.trim().toLowerCase();

  if (extension) {
    return extension;
  }

  return mimeType.split('/')[1]?.split(';')[0]?.trim().toLowerCase() || 'wav';
}

export function buildSttRequest(params: {
  apiKey: string;
  baseUrl: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  model: string;
}): SttRequest {
  const format = getConfiguredRequestFormat(params.baseUrl);

  if (format === 'json') {
    return {
      body: JSON.stringify({
        file: {
          data: params.buffer.toString('base64'),
          filename: params.fileName,
          format: getAudioFormat(params.fileName, params.mimeType),
        },
        model: params.model,
      }),
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  const formData = new FormData();
  formData.append('model', params.model);
  formData.append(
    'file',
    new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }),
    params.fileName,
  );

  return {
    body: formData,
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  };
}

export function getSttModel() {
  return getRequiredEnv('STT_MODEL');
}

export async function transcribeAudioFile(params: {
  fileName: string;
  filePath: string;
  mimeType: string;
}) {
  const baseUrl = getRequiredEnv('STT_API_BASE');
  const apiKey = getRequiredEnv('STT_API_KEY');
  const model = getSttModel();
  const buffer = await fs.readFile(params.filePath);
  const request = buildSttRequest({
    apiKey,
    baseUrl,
    buffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    model,
  });

  const response = await fetch(buildTranscriptionsUrl(baseUrl), {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SttError(`Transcription request failed with ${response.status}: ${body || response.statusText}`);
  }

  const payload = (await response.json()) as SttResponse;
  const transcript = payload.text?.trim();

  if (!transcript) {
    throw new SttError('Transcription provider returned no text.');
  }

  return transcript;
}
