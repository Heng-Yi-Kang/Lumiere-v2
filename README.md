# Lumiere

This repository now contains a Vite frontend in `frontend/` and a separate Next.js backend in `backend/`, with PostgreSQL, pgvector, and pgAdmin provided through Docker.

## Run Locally

**Prerequisites:** Node.js, pnpm via Corepack, and Docker Desktop.

1. From the repository root, install workspace dependencies:
   `pnpm install`
2. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`
3. Optionally copy [`.env.example`](.env.example) to `.env` for Docker defaults
4. Start PostgreSQL and pgAdmin:
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
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`
- pgAdmin: `http://localhost:5050`

## Frontend Routing

The frontend uses React Router for direct URL access while keeping app navigation based on semantic page names. The route registry lives in [`frontend/src/App.tsx`](frontend/src/App.tsx):

- `Dashboard` -> `/dashboard`
- `Notebooks` -> `/notebooks`
- `KnowledgeGraph` -> `/knowledge-graph`
- `Revision` -> `/revision`
- `StudyLounge` -> `/study-lounge`

The floating macOS-style dock and other shell-level navigation should call `setCurrentPage('PageName')` instead of pushing raw URLs. Detail context can still use query parameters; notebook detail selection uses `/notebooks?notebookId=<id>`.

See [`docs/frontend-routing.md`](docs/frontend-routing.md) for the routing pattern and maintenance rules.

## Database

The database container uses `pgvector/pgvector:0.8.2-pg16`, so the `vector` extension is available immediately through the init script in [`docker/postgres/init/001-enable-pgvector.sql`](docker/postgres/init/001-enable-pgvector.sql).

pgAdmin credentials and database credentials are defined in [`.env.example`](.env.example) and can be overridden in your local `.env` file.
Prisma reads `backend/.env` through `dotenv/config`, so keep that file aligned with the Docker database settings.
