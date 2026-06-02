const FRAME_DESCRIPTION_FAILURE_PATTERN = /frame description failed/i;
const RATE_LIMIT_PATTERN = /(?:\b429\b|rate-?limited)/i;
const NETWORK_FETCH_FAILURE_PATTERN = /(?:networkerror when attempting to fetch resource|failed to fetch|load failed)/i;
const RETRY_LATER_MESSAGE_PATTERN = /(?:temporarily unavailable|try again later)/i;

export function isNetworkFetchError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return NETWORK_FETCH_FAILURE_PATTERN.test(message);
}

export function isRetryLaterUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  return (
    RETRY_LATER_MESSAGE_PATTERN.test(message)
    || (FRAME_DESCRIPTION_FAILURE_PATTERN.test(message) && RATE_LIMIT_PATTERN.test(message))
  );
}

export function getRetryLaterUploadMessage() {
  return 'This service is temporarily unavailable. Please try again later.';
}

export function getGroundedChatErrorMessage(error: unknown) {
  if (isNetworkFetchError(error)) {
    return 'The grounded chat request lost connection before the response reached the browser. The backend may still finish processing; try again, or ask a narrower question if it keeps taking over a minute.';
  }

  return error instanceof Error ? error.message : 'Grounded chat failed.';
}
