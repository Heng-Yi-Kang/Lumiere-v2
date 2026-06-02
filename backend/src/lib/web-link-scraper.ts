import dns from 'node:dns/promises';
import net from 'node:net';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import puppeteer, { type Browser, type HTTPRequest } from 'puppeteer';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';

export const WEB_LINK_MAX_TEXT_CHARS = 200_000;
export const WEB_LINK_MIN_RAG_TEXT_CHARS = 300;
export const WEB_LINK_NAVIGATION_TIMEOUT_MS = 60_000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
]);

const ABORTED_RESOURCE_TYPES = new Set([
  'font',
  'image',
  'media',
  'stylesheet',
  'websocket',
]);

let browserPromise: Promise<Browser> | undefined;

export class WebLinkValidationError extends Error {}
export class WebLinkScrapeError extends Error {}

export type ScrapedWebLink = {
  excerpt?: string;
  finalUrl: string;
  siteName?: string;
  text: string;
  title: string;
  wordCount: number;
};

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;

  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 0)
    || a >= 224;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function isPrivateIpAddress(address: string) {
  const normalizedAddress = address.replace(/^\[(.*)]$/, '$1');
  const family = net.isIP(normalizedAddress);

  if (family === 4) {
    return isPrivateIpv4(normalizedAddress);
  }

  if (family === 6) {
    return isPrivateIpv6(normalizedAddress);
  }

  return false;
}

function isIpAddress(address: string) {
  return net.isIP(address.replace(/^\[(.*)]$/, '$1')) !== 0;
}

function assertHttpUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebLinkValidationError('Only http and https web links are supported.');
  }

  if (url.username || url.password) {
    throw new WebLinkValidationError('Web links with embedded credentials are not supported.');
  }
}

export function normalizeWebLinkUrl(input: string) {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new WebLinkValidationError('Enter a valid web link.');
  }

  assertHttpUrl(url);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  return url.toString();
}

export async function assertPublicWebLinkUrl(input: string) {
  const normalizedUrl = normalizeWebLinkUrl(input);
  const url = new URL(normalizedUrl);
  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new WebLinkValidationError('Localhost web links are not supported.');
  }

  if (isIpAddress(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new WebLinkValidationError('Private network web links are not supported.');
    }

    return normalizedUrl;
  }

  let addresses: Array<{ address: string }> = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new WebLinkValidationError('Could not resolve that web link host.');
  }

  if (!addresses.length || addresses.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new WebLinkValidationError('Private network web links are not supported.');
  }

  return normalizedUrl;
}

async function getBrowser() {
  browserPromise ??= puppeteer.launch({
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined,
    headless: true,
  });

  return browserPromise;
}

function shouldAbortRequest(request: HTTPRequest) {
  const resourceType = request.resourceType();

  if (ABORTED_RESOURCE_TYPES.has(resourceType)) {
    return true;
  }

  let url: URL;
  try {
    url = new URL(request.url());
  } catch {
    return true;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase()) || isPrivateIpAddress(url.hostname)) {
    return true;
  }

  return false;
}

function extractMetaContent(dom: JSDOM, selectors: string[]) {
  for (const selector of selectors) {
    const content = dom.window.document.querySelector(selector)?.getAttribute('content')?.trim();
    if (content) {
      return content;
    }
  }

  return undefined;
}

function extractReadableContent(html: string, pageUrl: string): ScrapedWebLink {
  const dom = new JSDOM(html, { url: pageUrl });
  const documentTitle = dom.window.document.title?.trim();
  const siteName = extractMetaContent(dom, [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
  ]);
  const description = extractMetaContent(dom, [
    'meta[property="og:description"]',
    'meta[name="description"]',
  ]);
  const article = new Readability(dom.window.document).parse();
  const title = normalizeWhitespace(article?.title || documentTitle || new URL(pageUrl).hostname);
  const text = normalizeWhitespace(article?.textContent || dom.window.document.body?.textContent || '');
  const truncatedText = text.slice(0, WEB_LINK_MAX_TEXT_CHARS);
  const excerpt = normalizeWhitespace(article?.excerpt || description || '').slice(0, 1000) || undefined;

  return {
    excerpt,
    finalUrl: pageUrl,
    siteName,
    text: truncatedText,
    title,
    wordCount: truncatedText ? truncatedText.split(/\s+/).filter(Boolean).length : 0,
  };
}

export async function scrapeWebLink(input: string): Promise<ScrapedWebLink> {
  const url = await assertPublicWebLinkUrl(input);
  const startedAt = performance.now();
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36 LumiereLinkIngest/1.0');
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (shouldAbortRequest(request)) {
        void request.abort();
        return;
      }
      void request.continue();
    });

    const response = await page.goto(url, {
      timeout: WEB_LINK_NAVIGATION_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });

    const contentType = response?.headers()['content-type'] || '';
    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      throw new WebLinkValidationError('Only HTML web pages are supported. Upload documents as files instead.');
    }

    await page.waitForNetworkIdle({ idleTime: 750, timeout: 5_000 }).catch(() => undefined);
    const finalUrl = await assertPublicWebLinkUrl(page.url());
    const html = await page.content();
    const result = extractReadableContent(html, finalUrl);

    logBackendProcess('info', 'web_link.scrape.completed', {
      elapsedMs: getElapsedMs(startedAt),
      extractedTextChars: result.text.length,
      siteName: result.siteName || null,
      title: result.title,
      url,
      wordCount: result.wordCount,
    });

    return result;
  } catch (error) {
    if (error instanceof WebLinkValidationError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown scrape error';
    logBackendProcess('error', 'web_link.scrape.failed', {
      elapsedMs: getElapsedMs(startedAt),
      error: message,
      url,
    });
    throw new WebLinkScrapeError(`Failed to scrape that web page: ${message}`);
  } finally {
    await page.close().catch(() => undefined);
  }
}
