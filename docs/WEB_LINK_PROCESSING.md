# Web Link Processing

## Lumiere-v2 Notebook Implementation

In this repository, web links are notebook materials, not subject textbooks. Users add a public web page through `POST /api/notebooks/:notebookId/links` from the Notebook View or Dashboard Add Link modal.

The backend validates `http`/`https`, rejects localhost/private-network targets, uses Puppeteer to render the submitted page, extracts readable text with DOM/readability parsing, stores the result as a `NotebookFile` with `type: "link"`, `sourceUrl`, optional `siteName`, text preview, and extracted text, then indexes the text through the existing notebook RAG path when enough readable text is available. Short pages still create a metadata/preview-only material but skip RAG indexing and summary generation.

The link flow is synchronous, matching current notebook file uploads. Production deployments need Chromium or Chrome available to Puppeteer; set `PUPPETEER_EXECUTABLE_PATH` if a system browser should be used.

## Legacy AIClassroom Notes

This note documents how teacher-submitted web links move through AIClassroom, from frontend URL entry to scraping, embedding, textbook metadata updates, summaries, and notifications.

## Entry Points

There are three URL-related paths in the current codebase:

1. **Create subject with URL sources**
   - UI: `apps/web/src/app/teacher/components/subjects/CreateSubjectForm.tsx`
   - Hook: `apps/web/src/app/teacher/components/subjects/useSubjectList.ts`
   - API: `POST /api/subjects/with-textbook`
   - Backend handler: `createSubjectWithTextbook` in `apps/api/src/subjects/subject.controller.ts`

2. **Add URL source to an existing subject**
   - UI: `apps/web/src/app/teacher/components/subjects/AddSourcesModal.tsx`
   - Hook: `apps/web/src/app/teacher/components/subjects/useSubjectDetail.ts`
   - API: `POST /api/subjects/:id/web-pages`
   - Backend handler: `addWebPage` in `apps/api/src/subjects/subject.controller.ts`

3. **Generic link ingestion route**
   - API: `POST /api/subjects/:id/ingest-link`
   - Backend router: `apps/api/src/subjects/link-ingest.routes.ts`
   - This route is registered before `subject.routes.ts` in `apps/api/src/index.ts`.
   - The current teacher UI does not appear to call this route directly.

## Frontend URL Handling

For subject creation, `CreateSubjectForm.tsx` validates URLs with the browser `URL` constructor and only accepts `http:` and `https:` protocols. Accepted URLs are stored in `textbookUrls`.

On submit, `useSubjectList.ts` appends URLs to the multipart request:

```ts
formData.append("textbookUrls", JSON.stringify(textbookUrls));
```

The request is sent to:

```text
POST /api/subjects/with-textbook
```

For existing subjects, `AddSourcesModal.tsx` lets the teacher add a pending source with `{ type: "url", url }`. `useSubjectDetail.ts` uploads each pending URL one by one to:

```text
POST /api/subjects/:id/web-pages
Content-Type: application/json
Body: { "url": "https://example.com" }
```

## URL Classification

URL classification lives in `apps/api/src/utils/linkResolver.ts`.

`categorizeUrl(url)` returns one of:

- `video_link`: YouTube URLs matching `youtube.com/watch?v=`, `youtube.com/embed/`, `youtube.com/v/`, or `youtu.be/`
- `document_link`: URLs whose pathname ends with `.pdf` or `.pptx`
- `web_article`: everything else

Only `http:` and `https:` URLs are accepted at route level.

## Existing Subject: `/web-pages` Processing

`addWebPage` in `subject.controller.ts` is the active add-source path used by the UI.

Flow:

1. Validate request body has a string `url`.
2. Parse with `new URL(url)` and reject non-HTTP protocols.
3. Load the subject by `_id` and authenticated teacher id.
4. Classify the URL with `categorizeUrl`.
5. If the URL is a YouTube or document URL, pass it to `resolveLink`.
6. If the URL is a normal web page, create or reuse an `AIJob` with `fileType: "WEB_PAGE"`.
7. Push a placeholder textbook entry into `subject.textbooks`:

```ts
{
  url,
  fileName: url,
  fileType: "web_page",
  uploadedAt: new Date(),
  aiJobId: job._id.toString(),
  transcriptionStatus: "pending"
}
```

8. Link the job back to the saved textbook id.
9. Create an upload success notification.
10. Return `202` with `message: "Web page queued for processing"` and the `jobId`.

The background worker is started in `apps/api/src/index.ts` with:

```ts
startQueueWorker(10000);
```

That worker polls queued jobs and dispatches `WEB_PAGE` jobs to `processWebPageJob` in `apps/api/src/video-jobs/videoProcessor.ts`.

## Web Page Job Processing

`processWebPageJob(job)` handles queued `WEB_PAGE` jobs.

Flow:

1. Resolve the target URL from `job.webPageMetadata.url` or the virtual `web-page://...` path.
2. Set progress to `20`.
3. Scrape the URL with `scrapeUrl(url)`.
4. Store page metadata on the job:

```ts
job.webPageMetadata = {
  url,
  title,
  siteName,
  excerpt,
  wordCount
};
```

5. If extracted text is missing or under 100 characters, mark the job completed without creating embeddings.
6. Otherwise, index the scraped text with:

```ts
indexContent(subjectId, formLevel, scrapedText, "web_page", {
  sourceUrl: url,
  webPageTitle: scrapedTitle
});
```

7. Mark the job completed and save `chunksCreated`.
8. Update the related textbook via `updateSubjectTextbook(job, scrapedText)`.
9. Create a processing notification.
10. Start summary generation asynchronously with `fireAndForgetSummarize(job, scrapedText)`.

The textbook update writes:

- `transcriptionStatus`: `completed` or `failed`
- `url`
- `fileName`: scraped page title
- `metadata.siteName`
- `excerpt`
- `scrapedText`

## Scraper Behavior

Scraping is implemented in `apps/api/src/utils/scraper.ts`.

It uses:

- `puppeteer` for page loading
- `jsdom` for DOM parsing
- `@mozilla/readability` for article extraction

Important behavior:

- A singleton headless browser is reused.
- The browser is launched with sandbox-disabling flags and performance-oriented flags.
- A random desktop user agent is selected from a small list.
- Request interception aborts images, stylesheets, fonts, media, and websockets.
- Navigation waits for `domcontentloaded`, then waits for either network idle or an `article` selector.
- Readability extracts `title`, `siteName`, `excerpt`, and text content.
- HTML entities are decoded and whitespace is normalized.
- `closeBrowser()` is called on API shutdown.

## Embedding and RAG Storage

Embedding is handled in `apps/api/src/utils/embeddings.ts`.

For web pages:

1. `indexContent` splits text into chunks.
2. Default chunk size is 2000 characters with 400 characters of overlap.
3. Embeddings are generated sequentially against `EMBEDDING_API_BASE`.
4. Chunks are inserted into `KnowledgeChunk`.
5. Web page chunks use `sourceType: "web_page"`.
6. Metadata includes `sourceUrl` and `webPageTitle`.

The indexed chunks are then available to the RAG flow through the same `KnowledgeChunk` collection used by other textbook sources.

## Create Subject URL Path

When creating a subject with URLs, `createSubjectWithTextbook` parses `req.body.textbookUrls` and loops through each URL.

Current behavior:

1. The subject is created first.
2. Each URL is processed via `resolveLink(url, subjectId, formLevel)`.
3. `resolveLink` classifies the URL.
4. For normal web pages, it calls `indexWebPageContent`, which scrapes and embeds immediately.
5. A textbook record is pushed to `subject.textbooks`.

Important caveat: `resolveLink` already indexes web page content through `indexWebPageContent`. In `createSubjectWithTextbook`, if `result.textbook.scrapedText` exists, the handler calls `indexContent` again on the same text. This can duplicate chunks for URLs added during subject creation.

## Generic `ingest-link` Route

`POST /api/subjects/:id/ingest-link` validates the URL, loads the teacher-owned subject, calls `resolveLink`, saves the returned textbook, and asynchronously summarizes scraped text.

`resolveLink` behavior:

- YouTube URLs currently throw: `YouTube videos are not supported. Only public websites are supported.`
- `.pptx` direct URL ingestion throws with a message instructing users to upload the file instead.
- `.pdf` URLs are downloaded to a temp file, extracted with `extractText`, embedded as `sourceType: "document"`, then the temp file is deleted.
- Web articles are scraped, embedded, and returned as `fileType: "web_page"`.

This route returns `201` when ingestion finishes successfully. Unlike `/web-pages`, it does not queue normal web pages through `AIJob`.

## Data Model

Web links are stored as textbook entries inside `Subject.textbooks` in `apps/api/src/subjects/subject.model.ts`.

Relevant fields:

- `url`
- `fileName`
- `fileType: "web_page"`
- `uploadedAt`
- `metadata.siteName`
- `scrapedText`
- `excerpt`
- `summary`
- `transcriptionStatus`

The field name `transcriptionStatus` is reused as a generic processing status for web pages, even though no transcription happens.

Background processing state is stored in `AIJob` in `apps/api/src/video-jobs/ai-job.model.ts`, with `fileType: "WEB_PAGE"` and `webPageMetadata`.

## Error and Retry Behavior

Route-level validation errors return `400`.

If scraping fails in `processWebPageJob`, the job fails unless it already has usable metadata. Failed jobs increment `retryCount`; the worker re-queues failed jobs after 30 seconds while `retryCount < maxRetries`.

The queue worker also recovers stale processing locks older than 30 minutes.

Scraper-level errors are normalized:

- Puppeteer network errors become `Network error fetching URL: ...`
- Puppeteer timeouts become `Timeout while loading URL: ...`
- Other load errors become `Failed to fetch URL: ...`
- Readability parse failure becomes `Failed to parse article content`

## Known Gaps and Risks

- **Duplicate indexing during subject creation:** `createSubjectWithTextbook` can index URL content twice because `resolveLink` indexes web pages and the controller indexes returned scraped text again.
- **Two ingestion patterns:** `/web-pages` queues web articles through `AIJob`, while `/ingest-link` processes them synchronously. This can make behavior differ depending on which endpoint is used.
- **Existing completed `WEB_PAGE` jobs are rarely reused:** `hasUsableContent` does not currently return true for `WEB_PAGE`, so completed web page jobs may not be treated as reusable content.
- **Document URL support is limited:** `.pdf` is supported through direct download; `.pptx` direct URL ingestion is rejected.
- **YouTube code exists but active resolver rejects YouTube links:** `youtubeProcessor.ts` contains transcript and audio fallback logic, but `resolveLink` currently rejects YouTube URLs before using it.
- **No explicit SSRF protection beyond protocol validation:** Routes reject non-HTTP protocols, but there is no visible private IP, localhost, DNS rebinding, or host allow/block list protection.
- **Scraper depends on Puppeteer availability:** production must provide Chromium or configure `PUPPETEER_EXECUTABLE_PATH`.
