# TXT Upload Processing

This document describes how notebook plain-text uploads are processed in the backend.

## Scope

TXT ingestion covers local multipart uploads through:

- `POST /api/notebooks/:notebookId/files`

## Supported format

TXT support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Accepted extension:

- `.txt`

Accepted MIME type:

- `text/plain`

Uploads are capped at `100 MB` per request batch and per file.

## Processing model

TXT processing is synchronous during upload. The request does not return until the backend has:

1. validated the notebook and file
2. stored the file under `backend/public/uploads/notebooks/<notebookId>/`
3. read the file as UTF-8 text
4. created the `NotebookFile` row
5. indexed extracted text into Qdrant and `NotebookFileChunk`

Summary generation starts afterward in the asynchronous notebook-file summary job.

## Extraction and preview

`persistNotebookUpload()` routes TXT files to `buildTxtPreview()`.

`buildTxtPreview()` reads the stored file with `fs.readFile(filePath, "utf8")` and stores:

- `extractedText = text`
- `previewContent = text`
- `previewFormat = "text"`

No additional parser, sanitizer, or media provider is used.

## RAG indexing

TXT files use the standard text chunking path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- `splitIntoRagChunks()` parses markdown-like headings, page or slide marker lines, lists, tables, equations, code fences, and paragraphs.
- Embeddings are generated sequentially.
- Vectors are stored in Qdrant.
- Chunk manifests are stored in PostgreSQL `NotebookFileChunk`.

## Summary generation

If extracted text is non-empty, the upload route sets `summaryStatus = "in-progress"` and starts `startNotebookFileSummaryJob()` after RAG indexing succeeds.

The summary source is the uploaded text itself.

## Operational requirements

TXT uploads require:

- writable upload storage
- embedding provider config
- Qdrant config
- chat provider config for summaries

## Current caveats

1. TXT files are read as UTF-8; other encodings can produce poor text.
2. Very large plain-text uploads still process synchronously during the request.
3. Summary generation is fire-and-forget in-process work and can remain unfinished if the server exits after upload succeeds.
