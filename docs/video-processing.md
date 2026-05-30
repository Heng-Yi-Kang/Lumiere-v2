# Video Processing Study

This document describes how local video files are processed in the current backend, how they are converted into searchable RAG content, and where the implementation has edge cases.

## Scope

This covers uploaded video files that enter the system through subject textbook upload routes.

It does not cover YouTube ingestion as an active feature, because current link ingestion rejects YouTube URLs in `apps/api/src/utils/linkResolver.ts`.

## Entry points

Video files are uploaded through:

- `POST /api/subjects/with-textbook`
- `POST /api/subjects/:id/textbooks`
- `POST /api/subjects/:id/textbooks/batch`

The controller identifies `.mp4` as video, computes a file hash, and calls `findOrCreateAIJob()` with:

- `fileType = "VIDEO"`

This creates a queued `AIJob` or reuses an existing completed/active one.

## Queue and execution model

Background processing is handled by the queue worker in `apps/api/src/video-jobs/videoProcessor.ts`.

Startup path:

- `apps/api/src/index.ts` calls `startQueueWorker(10000)`

Worker behavior:

- polls queued jobs every 10 seconds
- atomically locks one job with `findOneAndUpdate`
- recovers stale processing locks older than 30 minutes
- retries failed jobs up to `maxRetries` with a 30 second requeue delay

This worker processes more than video, but video is the most complex path.

## Video job pipeline

The main flow is `processVideoJob(job)` in `apps/api/src/video-jobs/videoProcessor.ts`.

Stages:

1. Extract metadata
2. Transcribe audio
3. Extract key frames
4. Describe frames with a VLM
5. Build video segments
6. Generate embeddings
7. Update subject textbook fields
8. Generate summary asynchronously

## Stage 1: Metadata extraction

Video metadata is extracted with `getVideoMetadata()` using `music-metadata`.

Stored metadata includes:

- `duration`
- `resolution`
- `frameRate`
- `codec`
- `bitrate`

If video metadata extraction fails, the code falls back to `getAudioMetadata()` to at least recover duration and codec-like audio format information.

## Stage 2: Audio transcription

Video transcription reuses the audio pipeline:

- `transcribeAudioFileWithTimestamps(job.filePath)`

That utility:

- extracts audio from the `.mp4` into a temporary WAV file
- splits into 30 second WAV chunks
- transcribes each chunk against the Whisper-compatible service
- merges those chunk results into `text`, `duration`, and coarse `segments`

If transcript text is missing or shorter than 100 trimmed characters:

- the job is still marked `completed`
- transcript text is saved back to the textbook
- no embeddings are created

## Stage 3: Frame extraction

Frame extraction happens in `apps/api/src/utils/extractFrames.ts`.

Implementation details:

- uses `ffprobe` to get duration
- uses `ffmpeg` to sample frames at roughly `duration / interval`
- default interval is 7 seconds
- hard cap is 60 frames
- extracted JPGs are written under `uploads/frames/video-<timestamp>/`

Despite comments mentioning keyframes or scene detection, the current code actually uses:

```text
ffmpeg -vf fps=<numFrames/duration>
```

So current behavior is uniform temporal sampling, not true scene-change-based extraction.

## Stage 4: Frame description

Frames are described in `apps/api/src/utils/describeFrame.ts`.

Behavior:

- each frame is read and base64-encoded
- sent to `OPENAI_API_BASE_URL /chat/completions`
- primary model from `VLM_MODEL`
- optional fallbacks from `VLM_FALLBACK_MODELS`
- concurrency-limited batching through `describeFramesParallel(frames, 2, context)`

The prompt asks for:

- what is shown
- what is happening
- visible content like equations, labels, or slide text

Descriptions are kept short, usually 1 to 2 sentences.

Frame description results are stored in:

- `AIJob.frameDescriptions[]`
- `AIJob.framesExtracted`

## Stage 5: Segment construction

After transcription and frame description, the worker calls `buildVideoSegments()`.

Normal case:

- each transcript segment becomes one video segment
- frame descriptions within a 1 second tolerance window of that segment are attached
- matching frame file paths are also attached

Fallback case:

- if there are no Whisper segments, each frame becomes a synthetic segment
- transcript text is replaced with a visual-only string
- each fallback segment spans `timestamp -> timestamp + 7`

This means video retrieval can still work even if only visual analysis succeeded.

## Stage 6: Embedding

Video indexing is done through `indexVideoContent()` in `apps/api/src/utils/embeddings.ts`.

For each segment, the code builds a content block like:

- segment timestamp header
- frame description lines
- transcript segment text

Embedding behavior depends on `probeEmbeddingCapability()`:

1. `multimodal`
   - sends `{ text, image_url }`
2. `batch_text`
   - embeds text only
3. `single_text`
   - embeds text only, one at a time

If multimodal works, the first frame image in the segment becomes the representative image for that embedding.

Stored chunk shape:

- `sourceType = "video_segment"`
- `metadata.videoTimestampStart`
- `metadata.videoTimestampEnd`
- `metadata.videoJobId`
- `metadata.videoFileName`
- `metadata.frameDescriptions`

If no segments can be built, the worker falls back to `indexContent(..., "video_transcript")` using an enriched transcript block.

## Stage 7: Subject textbook updates

When the job completes, `updateSubjectTextbook()` writes back to the matching `Subject.textbooks[]` entry.

Main fields:

- `transcriptionStatus`
- `transcriptText`
- `videoDuration`
- `videoMetadata.resolution`
- `videoMetadata.frameRate`
- `videoMetadata.codec`
- `transcriptUrl`
- `transcriptFileName`

It also writes a transcript text file into the uploads directory.

## Stage 8: Summary generation

After completion, `fireAndForgetSummarize()` runs on the transcript text and updates:

- `textbooks.$.summary`

This summary is transcript-based. Frame descriptions are not summarized separately.

## Retrieval behavior for video in RAG

Video chunks are retrieved by `retrieveRAGContext()` in `apps/api/src/rag/rag.service.ts`.

Special handling:

- video chunks are first similarity-ranked like all other chunks
- top coarse results are grouped by `videoJobId`
- temporally adjacent chunks within 30 seconds are merged into a single "video moment"
- result includes `videoSeekUrl` if a playable source URL can be recovered

Prompt formatting uses:

- `[VIDEO T+mm:ss - T+mm:ss]`
- optional `[Video Seek: ...#t=<start>]`

This makes chat responses sourceable back to a specific time window.

## Frontend status tracking

Video UI polling expects to fetch job state from:

- `GET /api/ai-jobs/:id`

The frontend hook is `apps/web/src/components/FileViewer/hooks/useVideoJobPolling.ts`.

However, there is an important implementation mismatch.

## Current caveats

1. Textbook creation code stores `aiJobId`, but the schema and frontend mostly expect `videoJobId`. Current video polling and status rendering can therefore break or silently fail depending on the serialized payload.
2. `extractFrames.ts` comments mention keyframe or scene detection, but the actual implementation is fixed-rate frame sampling.
3. Videos with transcripts shorter than 100 characters finish without any RAG embeddings.
4. Frame-description failures are collected in batches, but enough failures could weaken retrieval quality without failing the full job if some frames still succeed.
5. The whole video pipeline depends on both `ffmpeg` and `ffprobe` being installed.

## YouTube status

There is partially built YouTube processing code in `apps/api/src/utils/youtubeProcessor.ts`:

- transcript API support
- `yt-dlp` audio fallback
- YouTube segment indexing

But current `resolveLink()` explicitly rejects YouTube with:

- `YouTube videos are not supported. Only public websites are supported.`

So YouTube is present as dormant implementation, not active product behavior.

## Practical summary

The current video pipeline is multi-stage and stronger than a plain transcript-only design:

- transcript gives spoken content
- frame descriptions give visual grounding
- segment-level embeddings preserve time-local meaning
- retrieval can return timestamped moments instead of a whole file

The main operational risk is not the analysis pipeline itself. It is the data-contract mismatch between `aiJobId` and `videoJobId`.
