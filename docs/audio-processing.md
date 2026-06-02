# Audio Processing

This document describes the current `backend/` implementation for notebook audio uploads.

## Scope

Audio ingestion currently covers local file uploads through:

- `POST /api/notebooks/:notebookId/files`

There is no separate speech/transcription API in this repo. Audio processing exists only as part of notebook file upload.

## Supported formats

Audio support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Supported extensions:

- `.aac`
- `.flac`
- `.m4a`
- `.mp3`
- `.ogg`
- `.wav`

Accepted MIME types:

- `audio/aac`
- `audio/flac`
- `audio/m4a`
- `audio/mp3`
- `audio/mp4`
- `audio/mpeg`
- `audio/ogg`
- `audio/wav`
- `audio/x-m4a`
- `audio/x-wav`

Uploads are capped at `100 MB`.

## Entry point

The upload route lives in:

- [backend/src/app/api/notebooks/[notebookId]/files/route.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/app/api/notebooks/[notebookId]/files/route.ts)

The file-processing logic lives in:

- [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts)
- [backend/src/lib/stt.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/stt.ts)

## Processing model

Audio processing is synchronous during upload.

The request does not return until:

1. the file is validated and written to disk
2. transcription completes
3. the `NotebookFile` row is created
4. transcript chunks are embedded into Qdrant

Summary generation is not inline with the upload response. It starts afterward in a fire-and-forget `setImmediate()` job.

## Pipeline

For audio files, `persistNotebookUpload()` calls `buildAudioPreview()`, which:

1. stores the uploaded file under `backend/public/uploads/notebooks/<notebookId>/`
2. sends the file to the STT provider with `transcribeAudioFile()`
3. stores the returned plain transcript in both:
   - `NotebookFile.extractedText`
   - `NotebookFile.previewContent`
4. persists the file record
5. indexes transcript text into `NotebookFileChunk` and Qdrant via `indexNotebookFileForRag()`
6. starts `startNotebookFileSummaryJob()` if extracted text is non-empty

There is no separate queue, polling worker, or transcript post-processing stage.

## STT implementation

Transcription is implemented in [backend/src/lib/stt.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/stt.ts).

Behavior:

- Requires `STT_API_BASE`, `STT_API_KEY`, and `STT_MODEL`
- Sends the upload to `${STT_API_BASE}/audio/transcriptions`
- Uses multipart `FormData`
- Expects a JSON response with a `text` field
- Throws if the provider returns an error or empty text

The current helper returns plain transcript text only. It does not request or store timestamp segments, diarization, or word timing.

## Preview behavior

Audio previews are plain text transcripts:

- `previewFormat = "text"`
- `previewContent = transcript`
- `extractedText = transcript`

The frontend reads these values from:

- `GET /api/notebooks/:notebookId/files/:fileId`

There is no specialized audio transcript schema beyond the plain text preview payload.

## RAG indexing

Audio transcript indexing uses the standard notebook-file RAG path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- If no prebuilt chunks are supplied, `indexNotebookFileForRag()` splits `extractedText`
- Each chunk is embedded with the configured embedding provider
- Chunks are stored in Qdrant and mirrored in PostgreSQL `NotebookFileChunk`

For audio uploads, metadata is the generic notebook-file metadata rather than an audio-specific schema.

## Summary generation

After upload and indexing, the route starts:

- [backend/src/lib/notebook-file-summary-job.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-file-summary-job.ts)

That job:

1. reloads the `NotebookFile`
2. checks that `extractedText` is present
3. marks `summaryStatus = "in-progress"`
4. calls `generateNotebookFileSummary()`
5. stores the final summary string in `NotebookFile.summary`

Current summary states:

- `idle`
- `in-progress`
- `done`
- `error`

Unlike the previous subject/textbook implementation, summaries are stored directly on `NotebookFile`.

## Data model

Audio uploads populate the `NotebookFile` model in [backend/prisma/schema.prisma](/home/arch_Kang/projects/Lumiere-v2/backend/prisma/schema.prisma).

Relevant fields:

- `type = "audio"`
- `mimeType`
- `sourcePath`
- `previewFormat`
- `previewContent`
- `extractedText`
- `summary`
- `summaryStatus`
- `summaryError`
- `summaryGeneratedAt`

RAG metadata is persisted in `NotebookFileChunk`.

## Operational requirements

Audio uploads require:

- upload storage writable
- `STT_API_BASE`
- `STT_API_KEY`
- `STT_MODEL`
- embedding provider config
- Qdrant config

Startup health checks validate the STT provider and core storage dependencies in [backend/src/lib/startup-health.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/startup-health.ts).

## Current caveats

1. Audio processing is synchronous, so long uploads keep the request open until transcription and indexing finish.
2. Transcript previews have no timestamps.
3. Summary generation is asynchronous and can be lost if the process exits after upload succeeds but before the `setImmediate()` job finishes.
4. If STT config is missing, audio uploads fail during extraction rather than degrading gracefully.
