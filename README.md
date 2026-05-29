<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Lumiere v2

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

## Database

The database container uses `pgvector/pgvector:0.8.2-pg16`, so the `vector` extension is available immediately through the init script in [`docker/postgres/init/001-enable-pgvector.sql`](docker/postgres/init/001-enable-pgvector.sql).

pgAdmin credentials and database credentials are defined in [`.env.example`](.env.example) and can be overridden in your local `.env` file.
Keep the root `.env` and `backend/.env` values aligned so Prisma can connect to the same database that Docker starts.
