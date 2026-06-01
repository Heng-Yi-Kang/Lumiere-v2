# Video Processing

This document describes the current `backend/` implementation for uploaded notebook videos.

## Scope

This covers local video files uploaded through:

- `POST /api/notebooks/:notebookId/files`

YouTube or remote video ingestion is not implemented.

## Entry Point

Notebook uploads are handled in:

- `backend/src/app/api/notebooks/[notebookId]/files/route.ts`
- `backend/src/lib/notebook-files.ts`

Supported video extensions:

- `.mp4`
- `.mov`
- `.m4v`
- `.webm`

Supported MIME types:

- `video/mp4`
- `video/quicktime`
- `video/webm`
- `video/x-m4v`

The frontend accepts the same extensions from dashboard and notebook upload controls.

## Processing Model

Video processing is synchronous during upload, matching the current document and audio upload flow.

There is no background queue or polling model in this repo. A video upload only returns after extraction, transcription, frame description, summary generation, database persistence, and RAG indexing complete.

## Pipeline

The implementation lives in `backend/src/lib/video-processing.ts`.

Stages:

1. Read video duration with `ffprobe`.
2. Extract a mono 16 kHz WAV audio track with `ffmpeg`.
3. Transcribe the extracted WAV through the existing STT provider.
4. Sample video frames with `ffmpeg`.
5. Send sampled frames to a VLM through an OpenAI-compatible chat completions API.
6. Build timestamped video segments from transcript slices plus frame descriptions.
7. Save the plain transcript as `NotebookFile.extractedText`.
8. Save a transcript plus visual timeline as `NotebookFile.previewContent`.
9. Embed each timestamped segment into `NotebookFileChunk`.

## Audio Transcription

Video audio is extracted before transcription.

The extracted temporary file is passed to:

- `backend/src/lib/stt.ts`
- `transcribeAudioFile({ mimeType: "audio/wav" })`

Required STT environment variables:

- `STT_API_BASE`
- `STT_API_KEY`
- `STT_MODEL`

The current STT helper returns plain transcript text, not word-level or model-native timestamps.

## Frame Sampling

Frame extraction uses:

- `ffprobe` for duration
- `ffmpeg -ss <timestamp> -frames:v 1` for each sampled frame

Configuration:

- `VIDEO_SEGMENT_SECONDS`, default `30`
- `VIDEO_MAX_FRAMES`, default `60`
- `VIDEO_COMMAND_TIMEOUT_MS`, default `120000`

Frames are sampled around the midpoint of each segment, capped by `VIDEO_MAX_FRAMES`.

## VLM Descriptions

Each sampled JPG frame is base64 encoded and sent to `/chat/completions` with image input.

Environment variables:

- `VLM_API_BASE_URL` or legacy `VLM_API_BASE`, falling back to `CHAT_API_BASE_URL`, then `https://api.openai.com/v1`
- `VLM_API_KEY`, falling back to `CHAT_API_KEY`
- `VLM_MODEL`, falling back to `CHAT_MODEL`
- `VLM_TIMEOUT_MS`, default `45000`

The prompt asks for visible slide text, diagrams, equations, labels, people, objects, and actions in one or two concise sentences.

## Segment Construction

Segments are built by `buildVideoRagSegments()`.

Because the current STT provider wrapper returns plain text only, transcript words are distributed evenly across fixed-duration segments. This is a coarse timestamp strategy, not true word-level alignment.

Each segment contains:

- file name
- timestamp range
- visual description lines for frames inside the segment
- transcript slice for the same coarse segment

## RAG Storage

Video uploads use the existing `NotebookFileChunk` table. No schema migration is needed.

`indexNotebookFileForRag()` now accepts optional prebuilt chunks. For video, each prebuilt chunk is embedded as one timestamped segment.

Chunk metadata includes:

- `fileName`
- `fileType = "video"`
- `frameDescription`
- `transcript`
- `videoTimestampStart`
- `videoTimestampEnd`

Embeddings are still text embeddings. The embedded content includes the timestamp, transcript slice, and VLM description together.

## Preview Behavior

The stored notebook file preview exposes:

- video player using the uploaded source file
- transcript
- visual timeline with timestamped frame descriptions

The frontend renders this in `frontend/src/components/NotebookView.tsx`.

## Operational Requirements

The server running `backend/` must have:

- `ffmpeg`
- `ffprobe`
- STT provider configuration
- VLM provider configuration
- embedding provider configuration

## Current Caveats

1. Video processing is synchronous. Large files can make upload requests slow.
2. Transcript timestamps are coarse because the STT helper does not return native timestamp segments.
3. Frame sampling is uniform over time, not scene-detection based.
4. VLM frame descriptions are sequential, not batched or concurrency-limited.
5. RAG retrieval ranks video chunks like normal text chunks; it does not yet merge adjacent video hits into a single returned moment.
