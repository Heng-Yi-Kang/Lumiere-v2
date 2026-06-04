# Uploaded File Summary Generation

This document describes the current summary-generation flow for notebook uploads in `backend/`.

## Overview

Summaries are now generated per `NotebookFile`, not per subject textbook.

The current system has two behaviors:

- image uploads complete with an inline VLM-generated description that is stored immediately as the file summary
- all other supported file types start an asynchronous `setImmediate()` summary job after upload persistence and RAG indexing complete

The summary output is a single concise text string, not a structured JSON object.

## Main files

| Area | File | Role |
| --- | --- | --- |
| Upload route | `backend/src/app/api/notebooks/[notebookId]/files/route.ts` | Creates `NotebookFile`, indexes content, and starts async summary jobs. |
| File extraction | `backend/src/lib/notebook-files.ts` | Produces `extractedText` and previews for each supported file type. |
| Summary job | `backend/src/lib/notebook-file-summary-job.ts` | Loads file text, manages summary status transitions, and persists final output. |
| Summary provider call | `backend/src/lib/file-summary.ts` | Calls chat completions, trims source text, and returns a plain summary string. |
| Prisma schema | `backend/prisma/schema.prisma` | Defines `summary`, `summaryStatus`, `summaryError`, and `summaryGeneratedAt` on `NotebookFile`. |
| File preview route | `backend/src/app/api/notebooks/[notebookId]/files/[fileId]/route.ts` | Returns preview content plus current summary state. |
| Notebook serialization | `backend/src/lib/notebooks.ts` | Includes summary fields in notebook payloads. |
| Frontend notebook UI | `frontend/src/components/NotebookView.tsx` | Shows summary loading, error, and completed states. |

## Data model

Summaries are stored directly on `NotebookFile`:

```ts
model NotebookFile {
  summary            String?
  summaryStatus      String   @default("idle")
  summaryError       String?
  summaryGeneratedAt DateTime?
}
```

Current status values:

- `idle`
- `in-progress`
- `done`
- `error`

State transitions:

```text
idle -> in-progress -> done
                    -> error
```

## Upload entry point

All summary-producing uploads enter through:

- `POST /api/notebooks/:notebookId/files`

The upload route:

1. validates and stores the file
2. extracts `extractedText` and `previewContent`
3. creates a `NotebookFile`
4. indexes chunks into Qdrant and `NotebookFileChunk`
5. starts `startNotebookFileSummaryJob(fileId)` when appropriate

There is no separate summary endpoint to trigger generation and no background queue worker.

## Source text by file type

Summary generation depends on `NotebookFile.extractedText`.

Current extraction sources:

- `pdf`: parsed text from `officeparser`
- `docx`: raw text from `mammoth`
- `pptx`: parsed text from `officeparser`
- `txt`: file contents
- `audio`: STT transcript
- `video`: STT transcript from extracted WAV audio
- `image`: VLM-generated description

Image uploads are special: the generated description is stored immediately as both `extractedText` and `summary`, and `summaryStatus` is set to `done` during upload. No async summary job runs for images.

## Async summary job

The async job is implemented in [backend/src/lib/notebook-file-summary-job.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-file-summary-job.ts).

Behavior:

1. load the file by id
2. if the file does not exist, log and stop
3. if `extractedText` is empty, store:
   - `summary = null`
   - `summaryStatus = "error"`
   - `summaryError = "No extracted text is available to summarize."`
4. otherwise set:
   - `summaryStatus = "in-progress"`
   - `summaryError = null`
5. call `generateNotebookFileSummary()`
6. on success, store:
   - `summary`
   - `summaryStatus = "done"`
   - `summaryGeneratedAt = new Date()`
7. on failure, store:
   - `summaryStatus = "error"`
   - `summaryError = <message>`

The job is started with `setImmediate()`, so it is in-process only.

## Summary provider behavior

`generateNotebookFileSummary()` is implemented in [backend/src/lib/file-summary.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/file-summary.ts).

Required config:

- `CHAT_API_KEY`
- `CHAT_MODEL`

Optional config:

- `CHAT_API_BASE_URL`, default `https://api.openai.com/v1`
- `SUMMARY_REQUEST_TIMEOUT_MS`, default `180000`

Behavior:

- skips generation and returns `undefined` if `CHAT_API_KEY` or `CHAT_MODEL` is missing
- normalizes whitespace in the extracted text
- uses the full extracted text when it fits within `12000` characters
- samples representative chunks across long files when extracted text exceeds `12000` characters
- always keeps the summary prompt source within the `12000` character budget
- sends a single chat completion request to `/chat/completions`
- uses temperature `0.2`
- requests a concise 3 to 5 sentence study summary
- returns plain message content from the first choice

Large-file source selection:

- uses the existing RAG chunk splitter to segment long extracted text
- keeps the first and last chunks, then fills the remaining budget with evenly spaced chunks across the file
- trims only the final selected excerpt if the sampled text would exceed the prompt budget
- logs the source mode, selected chunk indexes, selected text length, and total chunk count for debugging

The current system does not:

- request JSON output
- retry failed summary calls automatically
- persist intermediate prompt data

## API surface

Failed notebook-file summaries can be retried manually with `POST /api/notebooks/:notebookId/files/:fileId`.

Summary state is exposed through:

- `GET /api/notebooks/:notebookId/files/:fileId`
- notebook payloads returned by the upload route

Preview response fields include:

- `summary`
- `summaryStatus`
- `summaryError`
- `summaryGeneratedAt`

## Frontend behavior

The notebook UI reads summary state from notebook/file payloads and the file preview route.

Current behavior in [frontend/src/components/NotebookView.tsx](/home/arch_Kang/projects/Lumiere-v2/frontend/src/components/NotebookView.tsx):

- `summaryStatus === "in-progress"` shows a generating state
- `summaryStatus === "error"` shows the stored error
- `summaryStatus === "done"` shows the summary text

The app also checks whether any file in a notebook is still `in-progress` to drive refresh behavior.

## Relationship to previews

Summaries and previews are separate:

- `previewContent` is the extracted/rendered file preview
- `summary` is a short study-oriented description

Examples:

- audio preview: timestamped transcript
- video preview: timestamped transcript
- image preview: generated image description
- image summary: the same generated image description
- document summary: separate concise text generated from `extractedText`

## Operational requirements

For async summaries on non-image files, the backend needs:

- `CHAT_API_KEY`
- `CHAT_MODEL`

If those variables are missing:

- uploads still succeed
- file extraction and RAG indexing still succeed
- the summary job moves the file to `error` because the provider returns no summary

Chat-provider presence is treated as optional in startup health because grounded chat can still function without every file having a generated summary.

## Current caveats

1. Summary generation is fire-and-forget in-process work. If the server exits after upload succeeds, the summary can remain `in-progress` or never complete.
2. Summary retry is manual; there is still no durable queue for automatic retry after process restarts.
3. There is no structured summary schema anymore; downstream consumers should treat `summary` as plain text.
4. Non-image summary generation depends entirely on `extractedText`, so poor extraction quality directly degrades summary quality.
5. Missing chat configuration does not block upload, but it does prevent successful summary completion.
