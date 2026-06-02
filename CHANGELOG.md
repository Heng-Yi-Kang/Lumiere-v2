# Changelog

## 2026-06-02

### Notebook chat and retrieval

- Replaced mock notebook chat replies with grounded answers built from uploaded notebook files.
- Added citations and clearer missing-context fallback messaging in the notebook chat panel.
- Remounted notebook chat state when switching notebooks so conversations reset cleanly.
- Moved notebook RAG vector storage into Qdrant while keeping PostgreSQL as the metadata manifest.
- Added cleanup and rollback handling for notebook and file vector records during delete and indexing failure paths.
- Diversified notebook-wide retrieval context with per-file caps and score tolerance to reduce redundant grounding passages.
- Added optional Qwen3-compatible reranking for retrieval, with fallback to raw vector scores when reranking is unavailable or fails.

### Uploads and content processing

- Added image upload support for notebooks with inline preview handling for common image formats.
- Generated VLM-backed image descriptions during upload and indexed those descriptions for notebook RAG.
- Renamed notebook file summary UI language to description so the frontend matches the backend-generated content.

### Backend health and API tooling

- Added startup provider reachability probes for embeddings, chat, STT, VLM, reranker, Qdrant, database, and upload storage.
- Failed backend startup on required dependency outages while allowing degraded startup for optional providers.
- Deferred startup health imports at runtime to avoid static client-side resolution issues in Next instrumentation.
- Extracted notebook upload root lookup into a shared helper and replaced direct Node and Qdrant imports with runtime-safe probes.
- Added Swagger UI at `/api` and exposed OpenAPI JSON at `/api/openapi.json` for backend route inspection and debugging.
- Documented notebook, file, note, health, and RAG routes in the generated OpenAPI surface.

### Frontend shell

- Simplified shell navigation by removing the `Revision` and `Study Lounge` routes from route registration and the floating dock.
- Removed the floating `Study Buddy` launcher while preserving access paths that still exist inside the app.

### Documentation

- Updated RAG documentation to describe the current PostgreSQL-plus-Qdrant storage model.
- Documented notebook chunk indexing, retrieval, and grounded chat fallback behavior.
- Replaced stale documentation that still described older MongoDB and in-memory search behavior.

## 2026-06-01

### Video uploads

- Added synchronous video upload processing to the notebook backend.
- Extracted audio from uploaded videos, transcribed the spoken track, and saved the transcript with the file record.
- Sampled video frames, described them with a VLM, and embedded timestamped transcript-plus-visual segments in RAG.
- Expanded notebook upload validation and preview UI to accept common video formats.

### Documentation

- Updated `docs/video-processing.md` to match the current backend implementation.
- Added backend environment variables for VLM configuration and video sampling controls.

## 2026-05-31

### Frontend navigation

- Kept the floating macOS-style dock as the active left navigation in the app shell.
- Removed the unused legacy `frontend/src/components/Sidebar.tsx` component so the codebase matches the rendered UI.

### Documentation

- Updated `AGENTS.md` routing guidance to refer to the floating dock instead of a sidebar.
- Updated `README.md` to describe the floating dock as the shell navigation entry point.

## 2026-05-30

### Frontend routing

- Added React Router to the Vite frontend.
- Introduced a page-name routing registry in `frontend/src/App.tsx` with `pageToPath` and `pathToPage`.
- Replaced sidebar tab state navigation with semantic page navigation through `setCurrentPage(pageName)`.
- Added direct URL support for the main app screens:
  - `/dashboard`
  - `/notebooks`
  - `/knowledge-graph`
  - `/revision`
  - `/study-lounge`
- Preserved notebook detail context with `/notebooks?notebookId=<id>` so the pathname still resolves to the `Notebooks` page.
- Added root and unknown-route redirects back to `/dashboard`.

### Documentation

- Added `docs/frontend-routing.md` to describe the routing pattern imported from the reference project.
- Updated README and agent guidance with the new routing contract.

### Verification

- Ran frontend `pnpm check` successfully.
- Verified the Vite dev server serves both `/` and `/notebooks?notebookId=example`.

## 2026-05-29

### Notebook module

- Implemented real notebook file upload from frontend to backend using multipart form data.
- Stored uploaded files on the backend filesystem under `backend/public/uploads/notebooks/<notebookId>/`.
- Saved file source URL in the database so uploaded materials can be referenced and rendered later.
- Added backend validation for supported notebook file types:
  - `pdf`
  - `docx`
  - `pptx`
  - `txt`
- Added backend validation for file size with a `100 MB` per-file limit.
- Added unique stored filenames to avoid filesystem collisions while preserving the original filename in the UI and database.

### Preview extraction

- Added derived preview generation during upload instead of parsing files on every modal open.
- Implemented preview strategy by file type:
  - `pdf`: inline embedded preview from stored file URL
  - `docx`: extracted HTML preview
  - `pptx`: extracted HTML preview
  - `txt`: extracted plain text preview
- Stored derived preview content and extracted text in the database for faster modal loading.
- Sanitized generated HTML preview content before sending it to the frontend.

### Notebook APIs

- Reworked `POST /api/notebooks/[notebookId]/files` to accept real file uploads.
- Added `GET /api/notebooks/[notebookId]/files/[fileId]` for lazy-loading file preview data.
- Added `DELETE /api/notebooks/[notebookId]/files/[fileId]` for hard deletion.
- Expanded CORS API method support to include `DELETE`.

### Database

- Updated `NotebookFile` schema to support:
  - `mimeType`
  - `sourcePath`
  - `previewFormat`
  - `previewContent`
  - `extractedText`
- Removed the old transcript-oriented storage path from notebook file persistence for this phase.
- Added and applied Prisma migration:
  - `backend/prisma/migrations/20260529233000_notebook_file_storage`

### Frontend

- Updated notebook API client to:
  - upload `File` objects
  - fetch preview payloads
  - delete notebook files
- Replaced notebook mock upload behavior with real upload behavior.
- Reworked notebook detail view around document uploads and inline modal preview.
- Added notebook file delete actions from both the file list and the preview modal.
- Updated dashboard upload flow to use actual file selection and backend upload instead of simulated material creation.
- Added shared client-side upload validation for:
  - unsupported extensions
  - empty files
  - files larger than `100 MB`
- Added clearer staged upload status messaging in both the dashboard and notebook workspace.
- Added `open in new tab` and `download` actions in the inline notebook material modal.
- Added a confirmation modal before destructive notebook file deletion.

### Testing and cleanup

- Added backend `vitest` coverage for notebook uploads, preview fetches, invalid file-type rejection, oversize rejection, and hard delete cleanup.
- Added a test seam to override the notebook upload root so filesystem write/delete behavior can be verified in temporary directories.
- Reduced `TODO.md` to the still-open strategic items now that the actionable upload and deletion follow-ups are complete.

### Verification

- Ran Prisma client generation.
- Ran backend typecheck successfully.
- Ran frontend typecheck successfully.
- Ran backend test suite successfully.
- Ran backend production build successfully.
- Ran frontend production build successfully.

### Current scope limits

- YouTube link and website ingestion are intentionally skipped for now.
- Office preview fidelity is content-first, not full layout-perfect rendering.
- Delete is hard delete only; there is no recycle bin or restore flow.
