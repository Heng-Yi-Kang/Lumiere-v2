# DOCX Upload Processing

This document describes how notebook DOCX uploads are processed in the backend.

## Scope

DOCX ingestion covers local multipart uploads through:

- `POST /api/notebooks/:notebookId/files`

## Supported format

DOCX support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Accepted extension:

- `.docx`

Accepted MIME type:

- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Uploads are capped at `100 MB` per request batch and per file.

## Processing model

DOCX processing is synchronous during upload. The request does not return until the backend has:

1. validated the notebook and file
2. stored the file under `backend/public/uploads/notebooks/<notebookId>/`
3. generated sanitized preview HTML
4. extracted raw text
5. created the `NotebookFile` row
6. indexed extracted text into Qdrant and `NotebookFileChunk`

Summary generation starts afterward in the asynchronous notebook-file summary job.

## Extraction and preview

`persistNotebookUpload()` routes DOCX files to `buildDocxPreview()`.

`buildDocxPreview()` uses `mammoth` in two modes:

- `mammoth.convertToHtml({ path })` for preview HTML
- `mammoth.extractRawText({ path })` for RAG and summary source text

The generated HTML is sanitized with `sanitize-html` before storage. The stored fields are:

- `extractedText = rawTextResult.value`
- `previewContent = sanitized HTML`
- `previewFormat = "html"`

## RAG indexing

DOCX files use the standard text chunking path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- `splitIntoRagChunks()` parses headings, lists, tables, equations, and paragraphs when those structures survive text extraction.
- Embeddings are generated sequentially.
- Vectors are stored in Qdrant.
- Chunk manifests are stored in PostgreSQL `NotebookFileChunk`.

## Summary generation

If extracted text is non-empty, the upload route sets `summaryStatus = "in-progress"` and starts `startNotebookFileSummaryJob()` after RAG indexing succeeds.

The summary source is `NotebookFile.extractedText`, not the sanitized HTML preview.

## Operational requirements

DOCX uploads require:

- writable upload storage
- `mammoth`
- `sanitize-html`
- embedding provider config
- Qdrant config
- chat provider config for summaries

## Current caveats

1. Complex DOCX layout may not round-trip into preview HTML exactly.
2. Images embedded in DOCX are not separately described or indexed.
3. Upload latency includes extraction and RAG indexing.
4. Summary generation is fire-and-forget in-process work and can remain unfinished if the server exits after upload succeeds.
