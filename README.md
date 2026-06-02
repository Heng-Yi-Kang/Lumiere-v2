# Lumiere

This repository contains a Vite frontend in `frontend/` and a Next.js backend in `backend/`, with PostgreSQL, Qdrant, pgvector support in PostgreSQL, and pgAdmin provided through Docker.

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

## Service Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Backend API docs: `http://localhost:3001/api`
- Backend OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`
- Qdrant: `http://localhost:6333`
- pgAdmin: `http://localhost:5050`

## Frontend Routing

The frontend uses React Router for direct URL access while keeping app navigation based on semantic page names. The route registry lives in [`frontend/src/App.tsx`](frontend/src/App.tsx):

- `Dashboard` -> `/dashboard`
- `Notebooks` -> `/notebooks`
- `KnowledgeGraph` -> `/knowledge-graph`

The floating macOS-style dock and other shell-level navigation should call `setCurrentPage('PageName')` instead of pushing raw URLs. Detail context can still use query parameters; notebook detail selection uses `/notebooks?notebookId=<id>`. The `Study Buddy` panel still exists, but it is opened from in-app actions rather than from a shell-level dock item.

See [`docs/frontend-routing.md`](docs/frontend-routing.md) for the routing pattern and maintenance rules.

## Retrieval and AI services

Notebook retrieval uses PostgreSQL for notebook and file metadata plus chunk manifests, and Qdrant for vector storage and retrieval. Optional reranking can be enabled with `ENABLE_RERANKING=true`. Image and video enrichment uses the VLM configuration in [`backend/.env.example`](backend/.env.example), with fallback to chat provider settings where supported.

See:
- [`docs/rag-processing.md`](docs/rag-processing.md) for chunking, Qdrant storage, retrieval, and grounded chat behavior
- [`docs/video-processing.md`](docs/video-processing.md) for video transcription and VLM frame description flow

## Database and config

The database container uses `pgvector/pgvector:0.8.2-pg16`, so the `vector` extension is available immediately through the init script in [`docker/postgres/init/001-enable-pgvector.sql`](docker/postgres/init/001-enable-pgvector.sql).
pgAdmin credentials and database credentials are defined in [`.env.example`](.env.example) and can be overridden in your local `.env` file.
Prisma reads `backend/.env` through `dotenv/config`, so keep that file aligned with the Docker database settings.

The backend startup path now runs provider reachability checks on server boot. Required dependencies such as embeddings, Qdrant, database access, and upload storage can fail startup; optional providers such as reranking and some media-specific flows degrade the health report instead.
