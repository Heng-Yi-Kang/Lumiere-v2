import { assertPublicWebLinkUrl, normalizeWebLinkUrl, WebLinkValidationError } from './web-link-scraper';

describe('web-link URL safety', () => {
  it('normalizes hashless http and https URLs', () => {
    expect(normalizeWebLinkUrl('https://Example.com/article#section')).toBe('https://example.com/article');
  });

  it('rejects localhost and private IP URLs before scraping', async () => {
    await expect(assertPublicWebLinkUrl('http://localhost:3000')).rejects.toBeInstanceOf(WebLinkValidationError);
    await expect(assertPublicWebLinkUrl('http://127.0.0.1/admin')).rejects.toBeInstanceOf(WebLinkValidationError);
    await expect(assertPublicWebLinkUrl('http://192.168.1.10/page')).rejects.toBeInstanceOf(WebLinkValidationError);
  });

  it('rejects non-http protocols', () => {
    expect(() => normalizeWebLinkUrl('file:///etc/passwd')).toThrow(WebLinkValidationError);
  });
});
