# Lumiere Architecture Overview

This document is a practical onboarding map for the current Lumiere codebase. It focuses on how the app is actually structured today, which parts are source-of-truth, and where behavior is split across frontend, backend, and local infrastructure.

## System at a glance

Lumiere is a `pnpm` workspace with two app packages:

- `frontend/`: a Vite + React + TypeScript single-page app
- `backend/`: a Next.js App Router service used primarily as an API backend

In local development, the frontend usually runs on port `3000` and the backend on `3001`. PostgreSQL, Qdrant, and pgAdmin run through Docker Compose from the repository root.

At a high level:

1. The frontend renders the study workspace, notebook views, and shell navigation.
2. The backend owns notebooks, uploaded files, file notes, retrieval, grounded chat, and OpenAPI docs.
3. PostgreSQL stores application data and chunk manifests.
4. Qdrant stores embeddings and retrieval payloads for notebook search/chat.

## Tech stack

### Frontend

- Vite 6
- React 19
- TypeScript
- React Router
- Tailwind CSS v4 via `@tailwindcss/vite`
- `motion` for animation
- `react-markdown`, `remark-math`, `rehype-katex`, and `rehype-highlight` for rich notebook/chat rendering

The frontend bootstraps from `frontend/src/main.tsx`, wraps the app in `BrowserRouter`, and renders a single shell component from `frontend/src/App.tsx`.

### Backend

- Next.js 15 App Router
- TypeScript
- Prisma ORM
- PostgreSQL
- Qdrant via `@qdrant/js-client-rest`
- Vitest for backend tests

The backend is not using Next.js for a traditional SSR website. It uses route handlers under `backend/src/app/api/**` as the primary HTTP API surface.

### AI and media integrations

The backend talks to OpenAI-compatible HTTP APIs for:

- chat completions
- embeddings
- speech-to-text
- vision-language processing
- optional reranking

These integrations live in `backend/src/lib/**` and are configured entirely through environment variables.

## Workspace layout

### Frontend structure

- `frontend/src/App.tsx`: shell orchestration, route registry, notebook loading, top-level view composition
- `frontend/src/components/`: main UI views and reusable UI pieces
- `frontend/src/lib/notebooksApi.ts`: frontend API client for notebook/file/chat/note endpoints
- `frontend/src/data/mockData.ts`: local mock/demo data still used by some non-notebook UI flows

### Backend structure

- `backend/src/app/api/**`: HTTP route handlers
- `backend/src/lib/**`: shared backend logic for persistence, uploads, RAG, providers, and health checks
- `backend/prisma/schema.prisma`: database schema
- `backend/public/uploads/notebooks/`: local uploaded file storage

### Infra and docs

- root `docker-compose` stack: PostgreSQL, Qdrant, pgAdmin
- `docs/frontend-routing.md`: page-name routing model
- `docs/rag-processing.md`: ingestion and retrieval flow
- `docs/SUMMARY_GENERATION.md`: async file-summary behavior

## Frontend architecture

`frontend/src/App.tsx` is the main frontend orchestrator. It is doing more than route rendering:

- derives the current logical page from the URL
- loads notebooks from the backend on startup
- refreshes notebooks while async file summaries are still generating
- performs optimistic updates for notebook edits/deletes
- tracks Study Buddy modal state and grounding scope
- passes view-specific callbacks into the top-level page components

The frontend is not fully backend-driven yet. There is a meaningful split:

- notebook data comes from the backend API
- some surrounding study UX, such as mock course/graph/streak data, still comes from `frontend/src/data/mockData.ts`

That means the current app is partly production-backed and partly demo-seeded, depending on the feature area.

### Frontend API boundary

`frontend/src/lib/notebooksApi.ts` is the main boundary between the SPA and the backend.

It handles:

- notebook CRUD
- notebook file upload/delete
- file preview fetches
- grounded chat requests
- file note CRUD

The client builds relative `/api/...` URLs by default. In local development, Vite proxies `/api` and `/uploads` to the backend server, so the frontend can behave as though it is same-origin.

## Routing model

The frontend uses React Router, but top-level navigation is intentionally expressed through semantic page names rather than raw path strings.

The source of truth is `pageToPath` in `frontend/src/App.tsx`:

- `Dashboard` -> `/dashboard`
- `Notebooks` -> `/notebooks`
- `KnowledgeGraph` -> `/knowledge-graph`

`App.tsx` derives the active page from `location.pathname`, then passes `currentPage` and `setCurrentPage(...)` into shell navigation components like the floating dock.

Important behaviors:

- shell navigation should use page names, not hard-coded URL strings
- notebook detail context lives in query params, not a separate shell page
- `/notebooks?notebookId=<id>` still resolves to the logical `Notebooks` page
- `/` and unknown routes redirect to `/dashboard`

The `Study Buddy` UI still exists, but it is no longer a shell-level route. It is opened from in-app actions and notebook context.

### Known documentation drift

`docs/frontend-routing.md` still documents `Revision` and `StudyLounge` in its example registry. The current implementation in `frontend/src/App.tsx` only exposes `Dashboard`, `Notebooks`, and `KnowledgeGraph` as shell routes. Treat the code as authoritative.

## Backend architecture

The backend is organized around route handlers plus shared library modules.

### Route layer

Notable API areas under `backend/src/app/api/**`:

- `/api/notebooks`: list and create notebooks
- `/api/notebooks/[notebookId]`: update and delete notebooks
- `/api/notebooks/[notebookId]/files`: upload notebook files
- `/api/notebooks/[notebookId]/files/[fileId]`: preview and delete files
- `/api/notebooks/[notebookId]/files/[fileId]/notes`: file-note CRUD
- `/api/notebooks/[notebookId]/rag/search`: retrieval endpoint
- `/api/notebooks/[notebookId]/rag/chat`: grounded notebook chat
- `/api/health`: lightweight database health check
- `/api/openapi.json` and `/api`: OpenAPI document and Swagger UI

The route handlers are intentionally thin. They validate request shape, coordinate domain calls, and serialize responses. Most of the real behavior lives in `backend/src/lib/**`.

### Service layer

Important backend library modules include:

- `prisma.ts`: Prisma client
- `notebooks.ts`: notebook serialization for API responses
- `notebook-files.ts`: upload validation, extraction, local storage, previews
- `rag.ts`: chunking, indexing, retrieval, prompt-context formatting
- `qdrant.ts`: collection initialization and vector store access
- `embeddings.ts`: embedding provider client
- `openai-chat.ts`: grounded chat completion client
- `notebook-file-summary-job.ts`: async per-file summary generation
- `startup-health.ts`: provider and dependency health checks

## Data model and persistence

PostgreSQL is the source of truth for application data. Prisma models currently center on:

- `Notebook`
- `NotebookFile`
- `FileNote`
- `NotebookFileChunk`

### PostgreSQL responsibilities

PostgreSQL stores:

- notebook metadata
- uploaded file metadata
- extracted-text summary state
- user-authored notes attached to files
- chunk manifests that map notebook/file/chunk records to Qdrant point IDs

### Qdrant responsibilities

Qdrant stores:

- chunk embeddings
- retrieval payloads such as notebook/file ids, chunk text, file names, and segment metadata

Vectors are not stored in PostgreSQL. The `NotebookFileChunk` table acts as the manifest and reconciliation layer between Postgres and Qdrant.

## Upload, indexing, and summary flow

The upload entrypoint is `POST /api/notebooks/[notebookId]/files`.

Current flow:

1. Validate the notebook exists.
2. Parse and persist the uploaded file to local storage.
3. Extract text and preview content based on file type.
4. Create a `NotebookFile` row in PostgreSQL.
5. Index the file into RAG:
   - split text into chunks or use prepared video segments
   - generate embeddings
   - ensure the Qdrant collection exists
   - upsert Qdrant points
   - write `NotebookFileChunk` manifest rows
6. If indexing fails, clean up the created DB row and stored file.
7. If extracted text exists, start async file-summary generation.

Supported file categories currently include:

- PDF
- DOCX
- PPTX
- TXT
- audio
- video
- image

Images are handled slightly differently: their vision-generated description can be stored immediately as both extracted text and summary.

## Retrieval and grounded chat flow

Grounded chat is implemented at `POST /api/notebooks/[notebookId]/rag/chat`.

Current flow:

1. Validate notebook and optional file scope.
2. Embed the user question.
3. Query Qdrant for notebook-scoped or file-scoped chunks.
4. Validate returned hits against PostgreSQL so stale vectors are discarded.
5. If retrieval returns nothing, fall back to stored extracted text chunking.
6. Select and diversify the final context set.
7. Send grounded context plus the question to the chat-completions provider.
8. Return answer, citations, grounded flag, and notebook/file scope metadata.

Important implementation detail: the backend instructs the chat model to answer only from the provided context and to say what is missing instead of guessing.

## Health checks and operational behavior

There are two different health surfaces:

- `/api/health`: a simple runtime database connectivity endpoint
- `backend/src/instrumentation.ts` startup hook: runs broader startup dependency checks once on boot

The startup health system can probe:

- database connectivity
- Qdrant availability
- embeddings provider
- chat provider
- STT provider
- VLM provider
- reranker provider
- upload directory writability

This means some dependency failures can block or degrade backend startup before the app even begins serving traffic.

## Testing posture

The frontend currently relies on typechecking and build validation more than dedicated automated tests.

Backend testing is stronger and centered on Vitest:

- API route tests
- RAG tests
- Qdrant tests
- startup health tests
- video-processing tests
- provider connectivity scripts for chat, embeddings, and VLM

For practical maintenance, backend behavior is generally safer to refactor with test coverage than the frontend shell/UI layer.

## Where to edit common changes

For common tasks, these are the main source-of-truth locations:

- add/change top-level frontend pages: `frontend/src/App.tsx`
- change shell navigation items: `frontend/src/components/FloatingDock.tsx`
- change notebook API calls in the frontend: `frontend/src/lib/notebooksApi.ts`
- change notebook serialization returned to the UI: `backend/src/lib/notebooks.ts`
- change notebook/file endpoints: `backend/src/app/api/notebooks/**`
- change RAG retrieval or chunking behavior: `backend/src/lib/rag.ts`
- change vector-store behavior: `backend/src/lib/qdrant.ts`
- change upload extraction/preview behavior: `backend/src/lib/notebook-files.ts`
- change summary generation: `backend/src/lib/notebook-file-summary-job.ts` and `backend/src/lib/file-summary.ts`

## Mental model for new contributors

The safest way to think about Lumiere today is:

- the frontend is a React SPA with a central shell component
- the backend is a Next.js API service with thin routes and heavier library modules
- Postgres is the application source of truth
- Qdrant is a specialized retrieval store
- notebook features are the most integrated production-style path
- some surrounding study/product surfaces are still powered by mock data

If code and docs disagree, prefer the implementation in `frontend/src/App.tsx`, `backend/src/app/api/**`, and `backend/src/lib/**`.
