type SttRequestFormat = 'json' | 'multipart';

export type SttRequest = {
  body: BodyInit;
  headers: Record<string, string>;
};

export function buildTranscriptionsUrl(baseUrl: string) {
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
        input_audio: {
          data: params.buffer.toString('base64'),
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
