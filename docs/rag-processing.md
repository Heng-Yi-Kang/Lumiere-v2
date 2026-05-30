# RAG Processing Study

This document describes the current Retrieval-Augmented Generation implementation used by chat and several content-generation features in `apps/api`.

## Scope

RAG in this codebase has two major phases:

1. Ingestion: convert subject resources into `KnowledgeChunk` rows with embeddings
2. Retrieval: embed the user query, score chunks in MongoDB application code, and format the best context for prompts

The current system is subject-scoped and form-level-scoped.

## Core storage model

RAG storage lives in `apps/api/src/embeddings/embedding.model.ts` as `KnowledgeChunk`.

Fields:

- `subject`
- `formLevel`
- `content`
- `embedding`
- `sourceType`
- `metadata`

Supported `sourceType` values include:

- `textbook`
- `audio_transcript`
- `video_transcript`
- `video_segment`
- `web_page`
- `document`
- `image_vlm`
- plus a few types that are defined but not central to the current flow

Indexes are basic Mongo indexes, not vector indexes:

- `{ subject: 1, formLevel: 1 }`
- `{ subject: 1, formLevel: 1, metadata.videoTimestampStart: 1 }`

Similarity search is done in application memory with cosine similarity.

## Ingestion sources

Current content can enter RAG from:

- uploaded documents
- uploaded audio
- uploaded video
- uploaded images
- pasted text
- scraped web pages
- remote PDF links

Main ingestion workers and helpers:

- `apps/api/src/video-jobs/videoProcessor.ts`
- `apps/api/src/utils/embeddings.ts`
- `apps/api/src/utils/extractText.ts`
- `apps/api/src/utils/transcribeAudio.ts`
- `apps/api/src/utils/describeImage.ts`
- `apps/api/src/utils/describeFrame.ts`
- `apps/api/src/utils/scraper.ts`

## Chunking strategy

`splitIntoChunks()` in `apps/api/src/utils/embeddings.ts` is used for text-like content.

Current constants:

- `CHUNK_SIZE = 2000` characters
- `CHUNK_OVERLAP = 400` characters

Algorithm:

1. split on paragraph boundaries first
2. accumulate paragraphs greedily until chunk size is exceeded
3. seed the next chunk with overlapping tail words from the previous chunk
4. if a chunk is still too large, split again by sentence boundaries

This is a simple textual chunker with no tokenization or semantic segmentation.

## Embedding service

Embeddings are generated through `apps/api/src/utils/embeddings.ts`.

Required env vars:

- `OPENAI_API_KEY`
- `EMBEDDING_API_BASE`
- `EMBEDDING_MODEL`

Notable behavior:

- a lightweight health check is run before attempts
- embeddings are generated sequentially for text chunk batches
- retry uses exponential backoff
- text input is truncated to 8000 characters before sending

The service can run in three detected capability modes:

1. `multimodal`
2. `batch_text`
3. `single_text`

This matters mostly for video segment indexing.

## Ingestion by source type

### Documents

`processDocumentJob()`:

- extracts text from PDF, TXT, DOCX, or PPTX
- indexes with `indexContent(..., "document")`

If text is shorter than 100 trimmed characters, the job completes but nothing is indexed.

### Pasted text

`processTextJob()`:

- reads `textContent` from `Subject.textbooks[]`
- indexes with `indexContent(..., "textbook")`

### Audio

`processAudioJob()`:

- transcribes audio
- indexes raw transcript text with `sourceType = "audio_transcript"`

### Video

`processVideoJob()`:

- builds transcript-plus-vision segments
- usually indexes with `sourceType = "video_segment"`
- falls back to `sourceType = "video_transcript"` if segment building fails

### Web pages

`processWebPageJob()` and `indexWebPageContent()`:

- scrape page text
- index with `sourceType = "web_page"`
- preserve URL and page title in metadata

### Images

`processImageJob()`:

- generates a VLM description
- indexes that description with `sourceType = "image_vlm"`

## Retrieval path for chat

Student chat uses `POST /api/chat/stream` in `apps/api/src/chat/chat.routes.ts`.

Core retrieval call:

- `retrieveRAGContext({ subjectId, formLevel, query, limit: 5, sourceFileName })`

Retrieval steps:

1. embed the user query with `generateEmbedding(query)`
2. load all chunks matching `subject` and `formLevel`
3. optionally filter by `metadata.sourceFileName`
4. compute cosine similarity in application memory
5. keep top `coarseLimit` chunks, default 50
6. cluster video chunks into larger temporal moments
7. return top `limit` results, default 5

This is a brute-force retrieval design. It is straightforward but will scale linearly with subject chunk count.

## Video-specific retrieval logic

Video retrieval is specialized in `apps/api/src/rag/rag.service.ts`.

Important behavior:

- video chunks from the same `videoJobId` are grouped
- neighboring chunks within 30 seconds are merged
- merged result keeps the best similarity score in the cluster
- a `videoSeekUrl` is created if the original textbook URL can be recovered

This makes chat citations for video more usable than raw segment-level hits.

## Prompt formatting

`formatRAGContextForPrompt()` transforms results into plain text blocks inserted into the system prompt.

Examples:

- `[VIDEO T+00:10 - T+00:40]`
- `[AUDIO TRANSCRIPT]`
- `[WEB PAGE] Title (URL)`
- `[TEXTBOOK]`

For chat, this formatted context is appended to the tutor system prompt as:

```text
Relevant context from learning materials:
...
```

If retrieval returns results, the route also streams source objects to the client over SSE before the answer text starts.

## Source references from the user

The chat route supports source-reference tags like:

```text
@[filename.pdf]
```

These are parsed in `parseSourceReferences()`. The tag is removed from the student message, and the extracted filename is passed as `sourceFileName` into retrieval.

That allows a query to constrain retrieval to one source file when metadata matches.

## Other RAG consumers

RAG is not only used for chat.

The same pattern appears in:

- `lesson-plans/lesson-plan.routes.ts`
- `lesson-plans/lesson-plan.queue.ts`
- `live-quizzes/live-quiz.routes.ts`
- likely other generation modules following the same direct chunk-retrieval pattern

Those routes often:

- embed a custom query
- load all chunks for subject or selected textbooks
- score with cosine similarity
- inject top excerpts into a generation prompt

So the project has one central chunk store, but more than one retrieval implementation.

## Current caveats

1. Retrieval is application-side brute force over all subject chunks. There is no vector database or ANN index yet.
2. There is duplicated retrieval logic. `rag.service.ts` exists, but lesson plans and live quizzes also implement their own cosine-scoring helpers.
3. `retrieveRAGContext()` supports `sourceFileName` filtering, but `KnowledgeChunk.metadata` schema does not explicitly define `sourceFileName`. If code writes it through strict schemas elsewhere, it may not persist consistently.
4. Relevance quality for audio and video depends heavily on transcript quality because transcript text remains the largest textual signal.
5. There is no reranking stage after similarity scoring.

## Practical summary

The current RAG stack is simple and understandable:

- ingest content into `KnowledgeChunk`
- embed queries on demand
- score everything for a subject in memory
- format top chunks into prompt context

Its strongest current feature is multi-format ingestion, especially video segments with timestamps. Its weakest point is retrieval scalability and the amount of retrieval logic duplicated across modules.
