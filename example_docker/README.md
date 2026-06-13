# Lumiere Example Docker Deployment

This folder is a single-host Docker Compose example for deploying Lumiere with frontend, backend, PostgreSQL, and Qdrant services.

The deployable frontend is a Vite static build served by Nginx. The backend is a production Next.js server. PostgreSQL stores notebook metadata and Qdrant stores retrieval vectors.

## Runtime Shape

- `frontend`: builds `frontend/` with pnpm and serves `dist/` through Nginx.
- `backend`: builds `backend/`, runs Prisma migrations, starts Next.js on port `3001`, includes Chromium for web-link scraping, and includes `yt-dlp` for YouTube link ingestion.
- `postgres`: stores metadata and enables the `pgvector` extension at first initialization.
- `qdrant`: stores vector retrieval data.
- Nginx exposes the public HTTP port, serves React Router routes with `index.html` fallback, and proxies `/api/` and `/uploads/` to `BACKEND_UPSTREAM`.

By default, `BACKEND_UPSTREAM` is `http://backend:3001`, which keeps API traffic on the internal Compose network.

## Quick Start

```bash
cd example_docker
./start_docker.sh
```

The script creates `.env` from `.env.example` if needed, builds the image, starts Compose, and prints the service status.

Default access URL:

```text
http://localhost:8080
```

## Configuration

Copy and edit the example environment file:

```bash
cd example_docker
cp .env.example .env
```

Important settings:

- `FRONTEND_PORT`: host port exposed by Nginx.
- `FRONTEND_BIND_ADDRESS`: host interface for the public Nginx port. Use `0.0.0.0` for direct remote access, or `127.0.0.1` when another reverse proxy on the same host terminates public traffic.
- `BACKEND_BIND_ADDRESS` and `BACKEND_PORT`: optional host binding for direct API access. The default binds only to localhost.
- `POSTGRES_*`: PostgreSQL database, username, and password.
- `DATABASE_URL`: backend Prisma database URL. Use the Compose service hostname `postgres`.
- `QDRANT_URL`: backend Qdrant URL. Use the Compose service hostname `qdrant`.
- `BACKEND_UPSTREAM`: Nginx upstream for `/api/` and `/uploads/`. Keep `http://backend:3001` for this Compose stack.
- `VITE_API_BASE_URL`: optional build-time browser API base URL.
- `NOTEBOOK_UPLOAD_HOST_DIR`: host folder for user-uploaded notebook files. The default is `./data/uploads/notebooks` inside this deployment folder.
- `PUPPETEER_EXECUTABLE_PATH`: Chromium executable used by Puppeteer for web-link scraping. The backend image sets this to `/usr/bin/chromium`.
- `EMBEDDING_API_BASE`, `EMBEDDING_API_KEY`, and `EMBEDDING_MODEL`: required for backend startup health and retrieval.
- `CHAT_*`, `STT_*`, `VLM_*`, and `RERANKER_*`: provider configuration for chat, media processing, and optional reranking.
- `*_TIMEOUT_MS` and `*_COMMAND_TIMEOUT_MS`: request and media command timeout controls for provider calls, audio/video processing, YouTube downloads, HLS generation, and summary generation.

Leave `VITE_API_BASE_URL` empty for the recommended same-origin deployment. In that mode, browser requests go to `/api/...` on the frontend origin and Nginx forwards them to `BACKEND_UPSTREAM`.

`./start_docker.sh` fails fast when required embedding settings are blank. `docker compose up` will also fail backend startup health if those values are missing or unreachable.

For frontend-only UI updates, rebuild and recreate the Docker service:

```bash
cd example_docker
docker compose build --no-cache frontend
docker compose up -d --force-recreate --no-deps frontend
```

`pnpm build:frontend` only updates local `frontend/dist/`; this Docker stack
does not mount that folder into Nginx.

## Remote Reverse Proxy Use

For direct remote access to this container's Nginx, keep:

```env
FRONTEND_BIND_ADDRESS=0.0.0.0
FRONTEND_PORT=8080
VITE_API_BASE_URL=
BACKEND_UPSTREAM=http://backend:3001
```

For a production reverse proxy such as Caddy, Traefik, or host-level Nginx in front of this stack, bind the container Nginx to localhost and proxy to it:

```env
FRONTEND_BIND_ADDRESS=127.0.0.1
FRONTEND_PORT=8080
VITE_API_BASE_URL=
BACKEND_UPSTREAM=http://backend:3001
FRONTEND_ORIGIN=https://your-public-domain.example
```

The included Nginx template preserves upstream `X-Forwarded-Host` and `X-Forwarded-Proto` values when an outer proxy sends them, so backend requests still see the public host and scheme. Keep `BACKEND_BIND_ADDRESS=127.0.0.1` unless you intentionally expose the backend separately.

## Backend and Database

The backend container runs this before starting:

```bash
pnpm exec prisma migrate deploy
```

Set `RUN_PRISMA_MIGRATIONS=false` only if migrations are handled separately.

Persistent database and vector data is stored in Docker volumes:

- `postgres_data`: PostgreSQL database files.
- `qdrant_data`: Qdrant vector storage.

User-uploaded notebook files are stored in the host folder configured by `NOTEBOOK_UPLOAD_HOST_DIR`, bind-mounted to `/app/backend/public/uploads/notebooks` in the backend container. By default this is:

```text
example_docker/data/uploads/notebooks
```

Back up this folder together with the PostgreSQL and Qdrant volumes when preserving user data.

PostgreSQL and Qdrant are intentionally not published to the host. Use `docker compose exec postgres ...` or `docker compose exec qdrant ...` for local administration, or add temporary host port mappings only on trusted networks.

## Alternate Backend Upstreams

The included stack uses:

```env
BACKEND_UPSTREAM=http://backend:3001
```

If you intentionally run the backend outside this Compose stack, point Nginx to that backend:

```env
BACKEND_UPSTREAM=http://host.docker.internal:3001
```

Public backend URL reachable directly by the browser:

```env
VITE_API_BASE_URL=https://api.example.com
FRONTEND_ORIGIN=https://app.example.com
SESSION_COOKIE_SAME_SITE=none
```

Use the public backend URL mode only when you intentionally do not want Nginx to keep API traffic on the frontend origin.

## Production Notes

- Put TLS termination in front of this Nginx container or extend the Nginx template with certificates.
- Keep `.env` server-local; do not commit secrets or environment-specific values.
- Replace default database credentials before any public deployment.
- If the folder is renamed, update `dockerfile: example_docker/Dockerfile.frontend` in `docker-compose.yml`.
- Run `docker compose logs -f frontend backend postgres qdrant` from this folder to inspect runtime output.

For deployment, use the production Compose stack in `production_docker/`.
