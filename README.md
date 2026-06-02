# Lumiere

This repository contains a Vite frontend in `frontend/` and a Next.js backend in `backend/`, with PostgreSQL, Qdrant, pgvector support in PostgreSQL, and pgAdmin provided through Docker.

## Deployed Project

View the deployed project at [https://yikang.org](https://yikang.org).

## Key Features

Lumiere is an AI-assisted study workspace for organizing course notebooks, uploading learning materials, and asking grounded questions over indexed content.

- **Authenticated study workspaces:** first-party email/password accounts with HTTP-only cookie sessions keep notebooks, files, notes, goals, and RAG queries scoped to the signed-in user.
- **Notebook-centered course organization:** learners can create notebooks by course or topic, edit notebook metadata, upload materials, browse files, and keep contextual detail state through direct URLs such as `/notebooks?notebookId=<id>`.
- **Multi-format material ingestion:** notebook uploads support PDF, DOCX, PPTX, TXT, common image files, audio files, and video files, with local upload storage and preview generation for supported content.
- **Audio and video understanding:** audio uploads are transcribed through the configured STT provider; video uploads extract audio, sample frames with `ffmpeg`, describe frames through the VLM provider, and index timestamped transcript/visual segments.
- **Grounded notebook chat:** Study Buddy and file-level chat use retrieved notebook chunks to answer questions with citations, and can be scoped to a whole notebook or a single uploaded file.
- **Retrieval-augmented search:** the backend chunks extracted material, generates embeddings, stores vectors in Qdrant, keeps chunk manifests in PostgreSQL, and validates retrieval hits against the current notebook/file records.
- **AI-generated file summaries:** uploaded files with extracted text can receive asynchronous summaries with visible generation states (`idle`, `in-progress`, `done`, `error`).
- **File notes and revision support:** learners can attach notes to uploaded files, review markdown-rich chat output, and use study prompts for summaries, exam angles, checklists, and revision questions.
- **Dashboard goals and streaks:** the dashboard tracks per-user study goals, priority goals, and study streak activity.
- **Knowledge graph view:** the frontend includes a semantic concept graph for exploring prerequisites, mastery status, and course-level relationships.
- **Admin console:** admin users can review user/account stats, enable or disable users, change roles, and manage sessions through the `/admin` page.
- **Operational observability:** backend startup health checks validate required providers and infrastructure, while Swagger UI and OpenAPI JSON expose the API surface for local inspection.

## Run Locally

**Prerequisites:** Node.js, pnpm via Corepack, and Docker Desktop.

1. From the repository root, install workspace dependencies:
   `pnpm install`
2. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`
3. Optionally copy [`.env.example`](.env.example) to `.env` for Docker defaults
4. Start PostgreSQL, Qdrant, and pgAdmin:
   `pnpm db:up`
5. Apply Prisma migrations:
   `pnpm --dir backend prisma:migrate:dev`
6. Run the backend:
   `pnpm dev:backend`
7. Run the frontend:
   `pnpm dev:frontend`

## Default Admin Login

The backend creates the default admin account automatically on startup and during admin login for local/demo workflows:

- Email: `admin@lumiere.my`
- Password: `admin1234`

Use this account to access the admin console at `http://localhost:3000/admin`. Replace or harden this default before any public deployment.

## Test Scripts

Workspace-level test and verification commands from the repository root:

- `pnpm typecheck:frontend`: run the frontend TypeScript checker
- `pnpm typecheck:backend`: run the backend TypeScript checker
- `pnpm test:llm:backend`: run the backend LLM connectivity test script
- `pnpm test:llm`: alias for `pnpm test:llm:backend`

Frontend validation commands from `frontend/`:

- `pnpm lint`: run `tsc --noEmit`
- `pnpm typecheck`: run `tsc --noEmit`
- `pnpm check`: run TypeScript checks and a production build

The frontend does not currently define a dedicated unit or integration test script.

Backend test and verification commands from `backend/`:

- `pnpm test`: run the backend Vitest suite
- `pnpm test:llm`: run the backend LLM connectivity checks
- `pnpm test:llm:chat`: run only chat-provider connectivity checks
- `pnpm test:llm:embeddings`: run only embeddings-provider connectivity checks
- `pnpm test:vlm`: run the VLM connectivity test file with Vitest
- `pnpm typecheck`: run the backend TypeScript checker
- `pnpm lint`: run the backend TypeScript checker

## Service Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Backend API docs: `http://localhost:3001/api`
- Backend OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`
- Qdrant: `http://localhost:6333`
- pgAdmin: `http://localhost:5050`

## Qdrant URL Configuration

The default local workflow runs only PostgreSQL, Qdrant, and pgAdmin in Docker. The backend is started on the host with `pnpm dev:backend`, so `backend/.env` should use:

```env
QDRANT_URL=http://localhost:6333
```

Use `http://qdrant:6333` only for a backend process that is also running inside the same Docker Compose network. If the host-run backend is configured with `http://qdrant:6333`, startup health checks fail with `qdrant-connectivity` because the host cannot resolve the Compose service name.

## Frontend Routing

The frontend uses React Router for direct URL access while keeping app navigation based on semantic page names. The route registry lives in [`frontend/src/App.tsx`](frontend/src/App.tsx):

- `Dashboard` -> `/dashboard`
- `Notebooks` -> `/notebooks`
- `KnowledgeGraph` -> `/knowledge-graph`

The floating macOS-style dock and other shell-level navigation should call `setCurrentPage('PageName')` instead of pushing raw URLs. Detail context can still use query parameters; notebook detail selection uses `/notebooks?notebookId=<id>`. The `Study Buddy` panel still exists, but it is opened from in-app actions rather than from a shell-level dock item.

See [`docs/frontend-routing.md`](docs/frontend-routing.md) for the routing pattern and maintenance rules.

## Retrieval and AI services

Notebook retrieval uses PostgreSQL for notebook and file metadata plus chunk manifests, and Qdrant for vector storage and retrieval. Qdrant is required for the current RAG flow. Reranking is optional and is only enabled when `ENABLE_RERANKING=true`. Image and video enrichment uses the VLM configuration in [`backend/.env.example`](backend/.env.example), with fallback to chat provider settings where supported.

## Further Reading

| Topic | Read this | Why |
| --- | --- | --- |
| Architecture overview | [`docs/architecture-overview.md`](docs/architecture-overview.md) | Onboarding map of the workspace, routing model, backend API layout, and RAG data flow |
| Frontend routing | [`docs/frontend-routing.md`](docs/frontend-routing.md) | Route registry, page-name navigation, and query-string detail state |
| RAG processing | [`docs/rag-processing.md`](docs/rag-processing.md) | Chunking, Qdrant storage, retrieval, and grounded chat behavior |
| Audio uploads | [`docs/audio-processing.md`](docs/audio-processing.md) | Notebook audio transcription, preview generation, and indexing flow |
| Video uploads | [`docs/video-processing.md`](docs/video-processing.md) | Video transcription, frame description, timestamped preview, and RAG chunking |
| File summaries | [`docs/SUMMARY_GENERATION.md`](docs/SUMMARY_GENERATION.md) | `NotebookFile` summary states, async summary job flow, and provider behavior |

## Database and config

The local stack started by `pnpm db:up` brings up three services:

- PostgreSQL for notebooks, files, notes, and `NotebookFileChunk` manifests
- Qdrant for chunk embeddings and retrieval payloads
- pgAdmin for database inspection during development

The PostgreSQL container uses `pgvector/pgvector:0.8.2-pg16`, and the init script in [`docker/postgres/init/001-enable-pgvector.sql`](docker/postgres/init/001-enable-pgvector.sql) enables the `vector` extension at boot. That said, the current RAG flow stores embeddings in Qdrant, not in PostgreSQL; PostgreSQL remains the source of truth for app data and chunk indexing history.

Docker-side defaults for PostgreSQL, pgAdmin, ports, and the host `DATABASE_URL` live in [`.env.example`](.env.example) and can be overridden in your local `.env` file. Backend runtime settings live in [`backend/.env.example`](backend/.env.example); Prisma reads `backend/.env` through `dotenv/config`, so keep `DATABASE_URL` aligned with the Docker database settings. For the standard host-run backend workflow, keep `QDRANT_URL=http://localhost:6333`.

Useful local database commands from the repository root:

- `pnpm db:up`: start PostgreSQL, Qdrant, and pgAdmin
- `pnpm db:down`: stop the local data services
- `pnpm db:logs`: stream Docker service logs
- `pnpm db:reset`: remove containers and named volumes

The backend startup path now runs provider reachability checks on server boot. Required dependencies such as embeddings, Qdrant, database access, and upload storage can fail startup; optional providers such as reranking and some media-specific flows degrade the health report instead.
