# PPTX Upload Processing

This document describes how notebook PPTX uploads are processed in the backend.

## Scope

PPTX ingestion covers local multipart uploads through:

- `POST /api/notebooks/:notebookId/files`

Direct PPTX URL ingestion is not implemented in the current notebook flow.

## Supported format

PPTX support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Accepted extension:

- `.pptx`

Accepted MIME type:

- `application/vnd.openxmlformats-officedocument.presentationml.presentation`

Uploads are capped at `100 MB` per request batch and per file.

## Processing model

PPTX processing is synchronous during upload. The request does not return until the backend has:

1. validated the notebook and file
2. stored the file under `backend/public/uploads/notebooks/<notebookId>/`
3. extracted slide text and notes with `officeparser`
4. generated sanitized preview HTML
5. created the `NotebookFile` row
6. indexed extracted text into Qdrant and `NotebookFileChunk`

Summary generation starts afterward in the asynchronous notebook-file summary job.

## Extraction and preview

`persistNotebookUpload()` routes PPTX files to `buildPptxPreview()`.

`buildPptxPreview()` uses `OfficeParser.parseOffice(filePath, { ignoreNotes: false })` so speaker notes are included when available. It stores:

- `extractedText = ast.toText()`
- `previewContent = sanitized ast.to("html") output`
- `previewFormat = "html"`
- `totalPages = slide count, falling back to parser page metadata`

## RAG indexing

PPTX files use the standard text chunking path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- `splitIntoRagChunks()` can attach slide metadata when extracted text contains slide marker lines such as `slide 4`.
- Embeddings are generated sequentially.
- Vectors are stored in Qdrant.
- Chunk manifests are stored in PostgreSQL `NotebookFileChunk`.

## Summary generation

If extracted text is non-empty, the upload route sets `summaryStatus = "in-progress"` and starts `startNotebookFileSummaryJob()` after RAG indexing succeeds.

The summary source is `NotebookFile.extractedText`, which includes parser-visible slide text and notes.

## Operational requirements

PPTX uploads require:

- writable upload storage
- `officeparser`
- `sanitize-html`
- embedding provider config
- Qdrant config
- chat provider config for summaries

## Current caveats

1. Slide images and diagrams are not separately passed through the VLM pipeline.
2. Slide-level metadata depends on parser output and chunker-readable slide markers.
3. Upload latency includes extraction and RAG indexing.
4. Summary generation is fire-and-forget in-process work and can remain unfinished if the server exits after upload succeeds.
