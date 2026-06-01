export const RETRY_LATER_UPLOAD_ERROR = 'This service is temporarily unavailable. Please try again later.';

export function isFrameDescriptionRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return /frame description failed/i.test(message) && /(?:\b429\b|rate-?limited)/i.test(message);
}
