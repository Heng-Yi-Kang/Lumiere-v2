# Changelog

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
