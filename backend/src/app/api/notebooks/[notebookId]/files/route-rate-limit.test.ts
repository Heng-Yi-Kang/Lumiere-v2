import { isFrameDescriptionRateLimitError } from '@/lib/upload-errors';

describe('isFrameDescriptionRateLimitError', () => {
  it('detects upstream frame-description rate limits', () => {
    const error = new Error(
      'Frame description failed with 429: {"error":{"message":"Provider returned error","metadata":{"raw":"temporarily rate-limited upstream"}}}',
    );

    expect(isFrameDescriptionRateLimitError(error)).toBe(true);
  });

  it('does not treat generic upload processing failures as rate limits', () => {
    expect(isFrameDescriptionRateLimitError(new Error('Failed to process uploaded file.'))).toBe(false);
  });
});
