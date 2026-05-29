# Changelog

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

### Verification

- Ran Prisma client generation.
- Ran backend typecheck successfully.
- Ran frontend typecheck successfully.
- Ran backend production build successfully.
- Ran frontend production build successfully.

### Current scope limits

- YouTube link and website ingestion are intentionally skipped for now.
- Office preview fidelity is content-first, not full layout-perfect rendering.
- Delete is hard delete only; there is no recycle bin or restore flow.
