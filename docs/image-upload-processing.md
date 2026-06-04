# Image Upload Processing

This document describes how notebook image uploads are processed in the backend.

## Scope

Image ingestion covers local multipart uploads through:

- `POST /api/notebooks/:notebookId/files`

Images embedded inside DOCX, PPTX, or PDF files are not separately extracted through this image pipeline.

## Supported formats

Image support is defined in [backend/src/lib/notebook-files.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/notebook-files.ts).

Supported extensions:

- `.bmp`
- `.gif`
- `.jpeg`
- `.jpg`
- `.png`
- `.tif`
- `.tiff`
- `.webp`

Accepted MIME types:

- `image/bmp`
- `image/gif`
- `image/jpg`
- `image/jpeg`
- `image/png`
- `image/tiff`
- `image/webp`
- `image/x-ms-bmp`

Uploads are capped at `100 MB` per request batch and per file.

## Processing model

Image processing is synchronous during upload. The request does not return until the backend has:

1. validated the notebook and file
2. stored the image under `backend/public/uploads/notebooks/<notebookId>/`
3. generated a VLM description
4. created the `NotebookFile` row
5. indexed the description into Qdrant and `NotebookFileChunk`

Images do not use the asynchronous summary job. The generated VLM description is stored immediately as the file summary.

## VLM description

`persistNotebookUpload()` routes image files to `buildImagePreview()`.

`buildImagePreview()` calls `describeImageFile()` in [backend/src/lib/vlm.ts](/home/arch_Kang/projects/Lumiere-v2/backend/src/lib/vlm.ts) with a study-oriented prompt. The prompt asks the model to mention visible text, diagrams, formulas, labels, tables, people, objects, and academic context.

Stored fields:

- `extractedText = generated description`
- `previewContent = "Generated image description" plus the description`
- `previewFormat = "text"`
- `summary = generated description`
- `summaryStatus = "done"` when the description is non-empty

## RAG indexing

Image uploads use the standard RAG indexing path, but the source text is the generated VLM description rather than OCR output or raw pixels.

Behavior:

- the description is split with `splitIntoRagChunks()`
- each chunk is embedded
- vectors are stored in Qdrant
- chunk manifests are stored in PostgreSQL `NotebookFileChunk`

## Operational requirements

Image uploads require:

- writable upload storage
- VLM provider config
- embedding provider config
- Qdrant config

The VLM helper resolves provider settings from `VLM_*` variables with chat-provider fallbacks where supported.

## Current caveats

1. Image retrieval quality depends on the VLM description; there is no separate OCR pipeline.
2. Animated images are treated as single uploaded image files, not frame sequences.
3. Upload latency includes the VLM call and RAG indexing.
4. Since the description is reused as the summary, image uploads do not get a second summary pass.
