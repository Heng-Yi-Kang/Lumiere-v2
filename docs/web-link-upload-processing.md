# Web Link Upload Processing

This document describes how notebook web links are processed in the backend.

## Scope

Web link ingestion covers JSON submissions through:

- `POST /api/notebooks/:notebookId/links`

This is notebook material ingestion, but it is not a multipart file upload. Users add links from the Notebook View or Dashboard Add Link modal.

Only public HTML pages are supported. Document URLs should be uploaded as files.

## Supported format

Web link support is defined in:

- [backend/src/app/api/notebooks/[notebookId]/links/route.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/app/api/notebooks/[notebookId]/links/route.ts)
- [backend/src/lib/web-link-scraper.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/web-link-scraper.ts)

Accepted protocols:

- `http`
- `https`

The backend rejects:

- invalid URLs
- embedded credentials
- duplicate links in the same notebook
- localhost links
- private network links
- non-HTML responses

## Processing model

Web link processing is synchronous. The request does not return until the backend has:

1. normalized and validated the URL
2. verified the notebook belongs to the authenticated user
3. checked for an existing `NotebookFile` with the same `sourceUrl`
4. rendered and scraped the page with Puppeteer
5. created the `NotebookFile` row
6. indexed readable text when enough text is available

Summary generation starts afterward only when the page has enough readable text for RAG.

## Scraping and extraction

`scrapeWebLink()` performs these steps:

1. validates the submitted URL with `assertPublicWebLinkUrl()`
2. resolves DNS and rejects private or localhost targets
3. launches or reuses a headless Puppeteer browser
4. aborts fonts, images, media, stylesheets, and websocket requests
5. navigates with `waitUntil: "domcontentloaded"`
6. rejects non-HTML content based on the response `content-type`
7. waits briefly for network idle
8. validates the final redirected URL
9. extracts readable content with `@mozilla/readability` and `jsdom`
10. truncates extracted text to `WEB_LINK_MAX_TEXT_CHARS`

Current constants:

- `WEB_LINK_MAX_TEXT_CHARS = 200000`
- `WEB_LINK_MIN_RAG_TEXT_CHARS = 300`
- `WEB_LINK_NAVIGATION_TIMEOUT_MS = 60000`

## Preview and storage

Web links are stored as `NotebookFile` records with:

- `type = "link"`
- `mimeType = "text/html"`
- `sourceUrl = normalized URL`
- `siteName = scraped site name when available`
- `name = scraped title or normalized URL`
- `previewFormat = "text"`
- `previewContent = excerpt plus extracted text, or metadata-only fallback text`
- `extractedText = scraped text`

The `NotebookFile` model has a unique constraint on `(notebookId, sourceUrl)` so the same URL cannot be stored twice in one notebook.

## RAG indexing

Readable web links use the standard text chunking path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- pages with fewer than `WEB_LINK_MIN_RAG_TEXT_CHARS` extracted characters skip indexing
- longer pages are chunked with `splitIntoRagChunks()`
- embeddings are generated sequentially
- vectors are stored in Qdrant
- chunk manifests are stored in PostgreSQL `NotebookFileChunk`

Short pages still create a metadata and preview-only notebook material with `summaryStatus = "idle"`.

## Summary generation

If the page has enough readable text for RAG, the route sets `summaryStatus = "in-progress"` and starts `startNotebookFileSummaryJob()` after indexing succeeds.

The summary source is `NotebookFile.extractedText`.

## Operational requirements

Web link ingestion requires:

- Chromium or Chrome for Puppeteer
- `PUPPETEER_EXECUTABLE_PATH` when a system browser should be used
- embedding provider config for indexed pages
- Qdrant config for indexed pages
- chat provider config for summaries

## Current caveats

1. Link scraping is synchronous and depends on target-site and browser latency.
2. Only HTML pages are supported; PDFs, PPTX files, videos, and other linked media are rejected.
3. Readability extraction can miss content in highly dynamic or app-like pages.
4. DNS validation reduces SSRF risk, but redirected and subresource behavior should still be reviewed before exposing broader network access.
