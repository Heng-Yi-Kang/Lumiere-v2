# PDF Upload Processing

This document describes how notebook PDF uploads are processed in the backend.

## Scope

PDF ingestion covers local multipart uploads through:

- `POST /api/notebooks/:notebookId/files`

Remote PDF URL ingestion is not implemented in the current notebook flow. Web links that resolve to non-HTML content are rejected and should be uploaded as files.

## Supported format

PDF support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Accepted extension:

- `.pdf`

Accepted MIME type:

- `application/pdf`

Uploads are capped at `100 MB` per request batch and per file.

## Processing model

PDF processing is synchronous during upload. The request does not return until the backend has:

1. validated the notebook and file
2. stored the file under `backend/public/uploads/notebooks/<notebookId>/`
3. extracted PDF text and page count with `officeparser`
4. created the `NotebookFile` row
5. indexed extracted text into Qdrant and `NotebookFileChunk`

Summary generation starts afterward in the asynchronous notebook-file summary job.

## Extraction and preview

`persistNotebookUpload()` routes PDFs to `buildPdfPreview()`.

`buildPdfPreview()` uses `OfficeParser.parseOffice(filePath)` and stores:

- `extractedText = ast.toText()`
- `previewFormat = "pdf"`
- `totalPages = ast.metadata.pages`

The preview route returns a file URL for the stored PDF through `sourceUrl`, allowing the frontend to render or link to the original PDF while RAG uses the extracted text.

## RAG indexing

PDFs use the standard text chunking path in [backend/src/lib/rag.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/rag.ts).

Behavior:

- `splitIntoRagChunks()` parses the extracted text into structural units.
- Page marker lines such as `page 3` can become chunk metadata when present in extracted text.
- Embeddings are generated sequentially.
- Vectors are stored in Qdrant.
- Chunk manifests are stored in PostgreSQL `NotebookFileChunk`.

## Summary generation

If extracted text is non-empty, the upload route sets `summaryStatus = "in-progress"` and starts `startNotebookFileSummaryJob()` after RAG indexing succeeds.

The summary source is `NotebookFile.extractedText`. The generated summary is stored on the same `NotebookFile` row.

## Operational requirements

PDF uploads require:

- writable upload storage
- `officeparser`
- embedding provider config
- Qdrant config
- chat provider config for summaries

## Current caveats

1. PDF extraction quality depends on `officeparser`; scanned/image-only PDFs may produce little or no text.
2. PDF page metadata is only as good as the parser output and chunker-readable page markers.
3. Upload latency includes extraction and RAG indexing.
4. Summary generation is fire-and-forget in-process work and can remain unfinished if the server exits after upload succeeds.
