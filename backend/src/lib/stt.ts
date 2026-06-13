import { buildSttRequest, buildTranscriptionsUrl } from '@/lib/stt-request';

export { buildSttRequest } from '@/lib/stt-request';

type SttResponse = {
  text?: string;
};

export class SttError extends Error {}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new SttError(`${name} is required for audio transcription.`);
  }

  return value;
}

export function getSttModel() {
  return getRequiredEnv('STT_MODEL');
}

function importRuntimeModule<T>(specifier: string): Promise<T> {
  return (new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<T>)(specifier);
}

export async function transcribeAudioFile(params: {
  fileName: string;
  filePath: string;
  mimeType: string;
}) {
  const { promises: fs } = await importRuntimeModule<typeof import('node:fs')>('node:fs');
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
