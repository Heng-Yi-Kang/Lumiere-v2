# Uploaded File Summary Generation

## Overview

Uploaded source materials can receive an AI-generated summary stored on the subject textbook entry. The summary is not generated inline during the upload request. Upload endpoints create the textbook record and queue or trigger background processing. Once usable text exists, the backend calls `summarizeText()` and writes the result to `textbooks.$.summary`.

The summary output is intended for secondary school learning material in Malaysia and has this shape:

```json
{
  "keyTakeaways": ["concise bullet point"],
  "learningObjectives": ["students will be able to..."],
  "briefSummary": "2-3 sentence overview in plain language",
  "difficultyLevel": "easy",
  "suggestedFocusAreas": ["topic 1"]
}
```

## Main Files

| Area | File | Role |
| --- | --- | --- |
| Upload routes | `apps/api/src/subjects/subject.routes.ts` | Defines upload, summary read, and regenerate endpoints. |
| Upload controllers | `apps/api/src/subjects/subject.controller.ts` | Creates textbook records, summary placeholders, and direct `setImmediate` summary jobs for some source types. |
| Queue worker | `apps/api/src/video-jobs/videoProcessor.ts` | Processes document/audio/video/web/text AI jobs, extracts text, embeds content, then starts summary generation. |
| Summary utility | `apps/api/src/utils/summarize.ts` | Truncates text, builds the LLM prompt, retries calls, parses JSON output. |
| Summary persistence | `apps/api/src/subjects/subject.service.ts` | Updates `textbooks.$.summary`. |
| Subject schema | `apps/api/src/subjects/subject.model.ts` | Defines the `summary` subdocument. |
| Teacher polling UI | `apps/web/src/app/teacher/components/subjects/useSubjectDetail.ts` | Polls in-progress summaries from the subject detail page. |
| File viewer UI | `apps/web/src/components/FileViewer/hooks/useAISummary.ts` | Fetches and polls an individual textbook summary for display. |
| Summary card | `apps/web/src/components/FileViewer/components/SummaryCard.tsx` | Renders loading and completed summaries. |

## Data Model

Each textbook can contain a `summary` object:

```typescript
interface ISummary {
  content: string;
  generatedAt: Date;
  status: 'in-progress' | 'done' | 'error';
  error?: string;
}
```

The `content` field stores a JSON string of the `SummaryResult` object when generation succeeds. During generation it is empty. On failure it remains empty and `error` stores the failure message.

Summary status transitions:

```text
not present -> in-progress -> done
                         \-> error
```

## Upload Entry Points

| Endpoint | Source type | Initial behavior |
| --- | --- | --- |
| `POST /api/subjects/with-textbook` | New subject plus files/text/URLs | Creates subject and textbook entries. Documents and pasted text get `summary.status = in-progress`. |
| `POST /api/subjects/:id/textbooks` | Single file upload | Creates an AI job. Documents get `summary.status = in-progress`; audio/video do not receive the placeholder until processing completes. |
| `POST /api/subjects/:id/textbooks/batch` | Multi-file upload | Creates AI jobs for each file. Documents get `summary.status = in-progress`. |
| `POST /api/subjects/:id/text` | Pasted text | Creates a `TEXT` AI job and `summary.status = in-progress`. |
| `POST /api/subjects/:id/web-pages` | Web page URL | Creates a `WEB_PAGE` AI job for normal web pages. Document links use direct link resolution. |
| `POST /api/subjects/:id/ingest-link` | Legacy link ingest route | Resolves and indexes a link, then uses `setImmediate` for summary generation if scraped text exists. |

Supported uploaded file extensions are declared in `subject.uploads.ts`: `.pdf`, `.txt`, `.docx`, `.pptx`, audio files, `.mp4`, and common image extensions. Images are described and embedded, but current image processing does not call `summarizeText()`.

## Backend Flow

### Document uploads

1. Upload controller creates a textbook record with `summary.status = in-progress`.
2. Controller creates an `AIJob` with `fileType = DOCUMENT`.
3. `startQueueWorker(10000)` in `apps/api/src/index.ts` polls queued jobs every 10 seconds.
4. `processDocumentJob()` extracts text through `extractText()`.
5. If extracted text is missing or shorter than 100 characters, the job completes without summary generation.
6. Otherwise the content is embedded with `indexContent()`.
7. The textbook processing status is updated.
8. `fireAndForgetSummarize(job, extracted.text)` runs in `setImmediate`.
9. Summary is written as `in-progress`, then `done` with JSON content, or `error`.

### Audio uploads

1. Upload controller creates an `AUDIO` AI job and a textbook with `transcriptionStatus = pending`.
2. `processAudioJob()` reads metadata and transcribes audio with timestamps.
3. If transcript text is shorter than 100 characters, the job completes without summary generation.
4. Otherwise the transcript is embedded.
5. Transcript fields are written back to the textbook.
6. `fireAndForgetSummarize(job, transcriptionResult.text)` generates the summary.

### Video uploads

1. Upload controller creates a `VIDEO` AI job and a textbook with `transcriptionStatus = pending`.
2. `processVideoJob()` extracts metadata, transcribes audio, extracts keyframes, describes frames, and embeds video content.
3. If transcript text is shorter than 100 characters, the job completes without summary generation.
4. Otherwise `fireAndForgetSummarize(job, job.transcript ?? '')` generates a summary from the transcript text.

### Web page uploads

There are two paths:

- `WEB_PAGE` AI jobs scrape the page in `processWebPageJob()`, embed the scraped text, write `scrapedText` back to the textbook, then call `fireAndForgetSummarize()`.
- Legacy link ingest resolves and indexes the page immediately, pushes the textbook entry, then starts a `setImmediate` summary job if scraped text is at least 100 characters.

### Pasted text

There are two paths:

- `POST /api/subjects/:id/text` creates a `TEXT` AI job. `processTextJob()` reads `textContent` from the textbook, embeds it, and calls `fireAndForgetSummarize()`.
- `POST /api/subjects/with-textbook` can process `textbookTexts` directly. It indexes the text and starts a controller-level `setImmediate` summary job.

## Summary Utility Behavior

`summarizeText(text, maxChars = 30000)` performs these steps:

1. Applies lead-tail truncation with a default 30,000-character limit.
2. Keeps the first 15,000 characters and last 15,000 characters when the input is too long.
3. Inserts `[... CONTENT SNIPPED ...]` between the two retained sections.
4. Sends a chat completion request to `${OPENAI_API_BASE_URL}/chat/completions`.
5. Uses `OPENAI_MODEL`, `OPENAI_API_KEY`, and temperature `0.3`.
6. Retries up to 3 times with exponential backoff: 1s, 2s, 4s.
7. Strips markdown fences if the LLM returns them.
8. Extracts the first JSON object from the response and parses it.

Required environment variables:

```text
OPENAI_API_KEY
OPENAI_API_BASE_URL
OPENAI_MODEL
```

If `OPENAI_API_KEY` or `OPENAI_API_BASE_URL` is missing, summary generation fails and the textbook summary is written with `status = error`.

## API Behavior

### Get summary

```http
GET /api/subjects/:id/textbooks/:textbookId/summary
```

Responses:

| State | HTTP status | Body |
| --- | --- | --- |
| No subject/textbook | `404` | Error message. |
| No summary field | `404` | `Summary not available for this textbook`. |
| In progress | `202` | `{ "status": "in-progress", "generatedAt": "...", "message": "Summary is still being generated" }` |
| Error | `200` | `{ "status": "error", "generatedAt": "...", "error": "..." }` |
| Done | `200` | `{ "status": "done", "generatedAt": "...", ...summaryFields }` |

Teacher access is scoped to the authenticated teacher's subject. Non-teacher roles can read by subject id in the controller logic, although the route itself is under teacher middleware in `subject.routes.ts`.

### Regenerate summary

```http
POST /api/subjects/:id/textbooks/:textbookId/summary/regenerate
```

Regeneration uses already persisted text only:

```typescript
textbook.transcriptText || textbook.scrapedText || textbook.textContent || ''
```

If none of those fields exist, the endpoint returns `400` with `No text content available to summarize`.

## Frontend Behavior

### Teacher subject detail

`useSubjectDetail.ts` polls every 10 seconds when any visible textbook has:

```typescript
tb.summary?.status === "in-progress" || tb.vlmStatus === "pending"
```

For normal summaries, it calls:

```text
/subjects/:subjectId/textbooks/:textbookId/summary
```

When a summary returns `done` or `error`, it refreshes the subject so the source file list updates.

### File viewer

`useAISummary.ts` first tries to parse `textbook.summary.content` from props. If the summary is already done, the viewer renders immediately without an API call.

If not, it fetches the summary endpoint and polls every 5 seconds while the server returns `in-progress`. It stops after 10 in-progress refetches and waits for parent data refresh.

`SummaryCard.tsx` hides summaries in `idle` and `error` states, shows a four-phase loading card while loading, and renders:

- `briefSummary`
- `difficultyLevel`
- `keyTakeaways`
- `suggestedFocusAreas`

`learningObjectives` are generated and returned by the backend but are not currently rendered in the summary card.

## Maintenance Scripts

| Script | Purpose |
| --- | --- |
| `node apps/api/scripts/check-subject-summaries.mjs` | Logs summary status for every textbook in all teacher subjects. |
| `node apps/api/scripts/reset-summary.mjs` | Calls regenerate for summaries in `error` state when persisted text exists. |

Both scripts use these optional environment variables:

```text
API_BASE_URL=http://localhost:5001/api
TEACHER_EMAIL=teacher@kpsti.edu.my
TEACHER_PASSWORD=password123
```

## Important Observations

1. Document text is extracted and embedded, but the full extracted text is not persisted on the textbook. If a PDF/TXT/DOCX/PPTX summary fails, `regenerateSummary` usually cannot retry it because it only checks `transcriptText`, `scrapedText`, and `textContent`.
2. Audio, video, web page, and pasted text summaries are easier to regenerate because their transcript, scraped text, or pasted text is stored.
3. Images are processed through VLM description and embedding, but no summary is generated by the current image job path.
4. Summary generation is fire-and-forget. If the Node process stops after the AI job completes but before the `setImmediate` summary finishes, the summary can remain stuck as `in-progress`.
5. Existing completed AI jobs can be reused for duplicate uploads, but summary reuse is limited by whether the textbook receives persisted usable content and whether `fireAndForgetSummarize()` is called for that path.
6. `check-subject-summaries.mjs` previews `JSON.parse(summary.content || '{}')?.summary`, but the actual summary schema uses `briefSummary`, so the preview can fall back to raw JSON content.

## End-to-End Sequence

```text
Teacher uploads source material
        |
        v
Multer stores file or controller records URL/text
        |
        v
Textbook entry added to Subject.textbooks
        |
        v
AIJob queued for documents/audio/video/web/text
        |
        v
Queue worker extracts usable text
        |
        v
Content embedded for RAG
        |
        v
fireAndForgetSummarize() starts
        |
        v
summarizeText() truncates content and calls LLM
        |
        v
Subject.textbooks.$.summary becomes done or error
        |
        v
Frontend polling refreshes and displays summary
```

