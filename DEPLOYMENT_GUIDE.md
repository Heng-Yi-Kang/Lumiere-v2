# Production Docker Deployment Setup

This guide is for deploying Lumiere with the local `production_docker/` Compose
stack. The stack runs the Vite frontend, Next.js backend, PostgreSQL, and Qdrant
on one Linux host.

## 1. Configure Environment

Create the server-local environment file:

```bash
cd production_docker
cp .env.example .env
```

Before a public deployment, edit `.env` and set at least:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` with the same PostgreSQL password
- `FRONTEND_ORIGIN` to the public HTTPS origin
- `EMBEDDING_API_BASE`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`

Recommended defaults:

- `FRONTEND_BIND_ADDRESS=127.0.0.1` when a host-level reverse proxy terminates public traffic and forwards to this stack.
- `FRONTEND_BIND_ADDRESS=0.0.0.0` only when the container Nginx port should be reachable directly from remote clients.
- `VITE_API_BASE_URL=` for same-origin browser API calls through Nginx.
- `BACKEND_UPSTREAM=http://backend:3001` for internal Compose routing.
- `BACKEND_BIND_ADDRESS=127.0.0.1` so direct backend access is local-only.
- `QDRANT_URL=http://qdrant:6333` because the backend runs inside Compose.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` for web-link scraping.

## 2. Start The Stack

Use the helper script:

```bash
cd production_docker
./start_docker.sh
```

Or run Compose directly:

```bash
cd production_docker
docker compose build
docker compose up -d
```

The default frontend URL from the deployment host is:

```text
http://localhost:8080
```

Put TLS termination in front of that port for public traffic. If the TLS proxy
runs on the same host, keep `FRONTEND_BIND_ADDRESS=127.0.0.1` and have the proxy
forward to `http://127.0.0.1:8080`. If remote clients should connect directly to
the container Nginx without an outer proxy, set `FRONTEND_BIND_ADDRESS=0.0.0.0`
and restrict access at the firewall as needed.

The Nginx template preserves incoming `X-Forwarded-Host`,
`X-Forwarded-Proto`, and `X-Forwarded-Port` headers when an outer proxy sends
them, so backend requests still see the public host and scheme.

## 3. Database Migrations

The backend entrypoint runs Prisma migrations by default:

```env
RUN_PRISMA_MIGRATIONS=true
```

Set it to `false` only when migrations are handled by another release step.
For manual migration deployment:

```bash
cd production_docker
docker compose run --rm backend pnpm exec prisma migrate deploy
```

## 4. Persistence

Persist and back up:

- Docker volume `postgres_data`
- Docker volume `qdrant_data`
- host folder `production_docker/data/uploads/notebooks`

Do not delete `production_docker/data/` during releases unless uploaded notebook
files are intentionally being removed.

## 5. Operations

Check status:

```bash
cd production_docker
docker compose ps
```

Read logs:

```bash
cd production_docker
docker compose logs -f frontend backend postgres qdrant
```

Restart after `.env` changes:

```bash
cd production_docker
docker compose up -d
```

Rebuild after pulling code changes:

```bash
cd production_docker
docker compose build
docker compose up -d
```

## 6. Verification

After deployment, verify:

- `GET /health` on the frontend port returns `ok`.
- `GET /api/health` returns backend health.
- `GET /api/openapi.json` returns the OpenAPI document.
- Login works and sets the session cookie.
- Notebook creation works.
- File upload writes to `production_docker/data/uploads/notebooks`.
- Web-link upload fetches a public HTTP or HTTPS page and stores it as notebook material.
- Retrieval and notebook chat work with uploaded content.

For web-link scraping, verify Chromium in the backend image:

```bash
cd production_docker
docker compose exec backend chromium --version
docker compose exec backend test -x "$PUPPETEER_EXECUTABLE_PATH"
```

## 7. Security Notes

- Keep `production_docker/.env` server-local.
- Replace default database credentials before public exposure.
- Keep PostgreSQL and Qdrant off public networks.
- Keep direct backend binding on `127.0.0.1` unless there is a controlled reason to expose it.
- Review the default admin bootstrap behavior before broad production use.
- The web-link scraper blocks private network targets, but the backend still needs outbound HTTP/HTTPS access for public pages.
