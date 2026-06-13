# Video Processing

This document describes the current `backend/` implementation for uploaded notebook videos.

## Scope

Video ingestion currently covers local file uploads through:

- `POST /api/notebooks/:notebookId/files`

Remote video ingestion and YouTube ingestion are not implemented.

## Supported formats

Video support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Supported extensions:

- `.mp4`
- `.mov`
- `.m4v`
- `.webm`

Accepted MIME types:

- `video/mp4`
- `video/quicktime`
- `video/webm`
- `video/x-m4v`

Uploads are capped at `100 MB`.

## Entry point

Main files:

- [backend/src/app/api/notebooks/[notebookId]/files/route.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/app/api/notebooks/[notebookId]/files/route.ts)
- [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts)
- [backend/src/lib/video-processing.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/video-processing.ts)
- [backend/src/lib/video-ingestion-job.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/video-ingestion-job.ts)

## Processing model

Video ingestion is asynchronous after the stored file row is created.

The upload request returns after the backend has:

1. written the uploaded file to disk
2. created a `NotebookFile` with `status = "processing"`
3. enqueued a durable `NotebookFileIngestionJob`
4. started independent HLS generation

The backend worker then claims queued video ingestion jobs from PostgreSQL and runs transcript extraction, frame description, RAG indexing, and summary scheduling in the background. Jobs run sequentially in-process with up to three attempts. If all attempts fail, the file remains visible with `status = "error"` and `ingestionError` set.

## Pipeline

`persistNotebookUploadShell()` validates and stores the upload without extracting video content. The upload route creates the processing file row and enqueues the durable ingestion job.

`processVideoIngestionJob()` loads the stored file and calls `processVideoFile()`.

`processVideoFile()` performs these steps:

1. create a temporary working directory
2. read duration with `ffprobe`
3. extract a mono `16 kHz` WAV audio track
4. transcribe the WAV through `transcribeAudioFile()`
5. sample JPG frames across the video
6. describe each frame with `describeImageFile()`
7. build `VideoRagSegment[]` with transcript slices plus frame descriptions
8. build a timestamped transcript preview from those segments
9. clean up temporary audio and frame files

Returned values:

- `transcript`
- `previewContent`
- `ragSegments`
- `durationSeconds`

## Audio transcription

Video audio transcription uses the same STT helper as audio uploads:

- [backend/src/lib/stt.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/stt.ts)

Required environment variables:

- `STT_API_BASE`
- `STT_API_KEY`
- `STT_MODEL`
- `STT_REQUEST_FORMAT`, optional. Defaults to `multipart`; use `json` for providers that reject multipart uploads.
- `STT_MAX_CHUNK_MB`, optional. Defaults to `20`; extracted audio larger than this is split with ffmpeg before transcription.
- `STT_CHUNK_COMMAND_TIMEOUT_MS`, optional. Defaults to `120000`.

The helper returns plain text only. It does not provide native timestamps, so video timestamping is synthesized later.

## Frame sampling

Frame extraction is implemented in [backend/src/lib/video-processing.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/video-processing.ts).

Config:

- `VIDEO_SEGMENT_SECONDS`, default `30`
- `VIDEO_MAX_FRAMES`, default `60`
- `VIDEO_COMMAND_TIMEOUT_MS`, default `120000`

Behavior:

- frame timestamps are distributed evenly across the video duration
- the sample is taken near the midpoint of each time bucket
- extraction uses `ffmpeg -ss <timestamp> -frames:v 1`

This is uniform time sampling, not scene detection.

## VLM descriptions

Each sampled JPG frame is described through the VLM helper in [backend/src/lib/vlm.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/vlm.ts).

Provider resolution:

- `VLM_API_KEY`, fallback `CHAT_API_KEY`
- `VLM_API_BASE_URL`, fallback `VLM_API_BASE`, then `CHAT_API_BASE_URL`, then `https://api.openai.com/v1`
- `VLM_MODEL`, fallback `CHAT_MODEL`
- `VLM_TIMEOUT_MS`, default `45000`

Prompt intent:

- mention visible slide text
- mention diagrams, equations, and labels
- mention people, objects, and actions
- keep the output to one or two concise sentences

Frame descriptions are processed sequentially. There is no batching or concurrency control.

## Segment construction

RAG segment construction is handled by `buildVideoRagSegments()`.

Because the transcript is plain text only, the code splits words evenly across fixed-duration buckets. Each segment contains:

- file name
- timestamp range
- frame descriptions inside that range
- transcript words assigned to that range

This produces coarse timestamps, not model-native alignment.

## Preview behavior

The stored preview for video files is a timestamped transcript, not the raw frame descriptions.

Stored fields:

- `previewFormat = "text"`
- `previewContent = buildTimestampedTranscriptPreview(...)`
- `extractedText = transcript`

If no spoken transcript is available, the preview text becomes:

- `No spoken transcript is available for this video.`

The frontend displays the preview through:

- `GET /api/notebooks/:notebookId/files/:fileId`

## RAG storage

The video ingestion worker passes prebuilt `ragSegments` into `indexNotebookFileForRag()` in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Each segment is embedded as one chunk. Chunk metadata includes:

- `fileName`
- `fileType = "video"`
- `frameDescription`
- `transcript`
- `videoTimestampStart`
- `videoTimestampEnd`

The text sent for embeddings includes the timestamp, transcript slice, and frame description together.

Chunk records are stored in:

- Qdrant
- PostgreSQL `NotebookFileChunk`

## Summary generation

After video ingestion and RAG indexing succeed, the worker starts `startNotebookFileSummaryJob()` when the transcript is non-empty.

For video, the summary source is the plain transcript in `NotebookFile.extractedText`, not the timestamped preview and not the frame descriptions.

Summary persistence lives on `NotebookFile`:

- `summary`
- `summaryStatus`
- `summaryError`
- `summaryGeneratedAt`

## Operational requirements

Video uploads require:

- writable upload storage
- `ffmpeg`
- `ffprobe`
- STT provider config
- VLM provider config
- embedding provider config
- Qdrant config

Startup health checks validate these dependencies in [backend/src/lib/startup-health.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/startup-health.ts).

## Current caveats

1. Video upload returns before transcript extraction, frame description, and RAG indexing complete.
2. Transcript timestamps are synthetic because the STT helper returns plain text only.
3. Frame sampling is uniform over time and can miss fast scene changes.
4. Frame descriptions are sequential and can make ingestion slow or rate-limited.
5. Summaries are transcript-only; visual frame descriptions do not feed the summary job.
6. Summary generation is still fire-and-forget after video ingestion succeeds.
