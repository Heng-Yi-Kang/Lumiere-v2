import { promises as fs } from 'node:fs';

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

function buildTranscriptionsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/audio/transcriptions`;
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
  const formData = new FormData();

  formData.append('model', model);
  formData.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: params.mimeType }),
    params.fileName,
  );

  const response = await fetch(buildTranscriptionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
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
