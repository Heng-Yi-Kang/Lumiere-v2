# Production Docker Deployment Setup

This guide is for a coding agent setting up Lumiere on a deployment server.
The tracked Docker template lives in `example_docker/`. The deploy server uses a
local `production_docker/` copy, which is intentionally ignored by git so server
`.env`, logs, upload data, and deployment-only edits do not enter the repository.

## 1. Create The Deployment Folder

From the repository root on the deployment server:

```bash
rm -rf production_docker
cp -a example_docker production_docker
```

Rewrite internal paths so Compose builds from `production_docker/`:

```bash
perl -pi -e 's#example_docker/Dockerfile.frontend#production_docker/Dockerfile.frontend#g' production_docker/docker-compose.yml
perl -pi -e 's#example_docker/Dockerfile.backend#production_docker/Dockerfile.backend#g' production_docker/docker-compose.yml
perl -pi -e 's#example_docker/backend-entrypoint.sh#production_docker/backend-entrypoint.sh#g' production_docker/Dockerfile.backend
perl -pi -e 's#example_docker/nginx/templates#production_docker/nginx/templates#g' production_docker/Dockerfile.frontend
perl -pi -e 's#example_docker/#production_docker/#g; s#cd example_docker#cd production_docker#g' production_docker/README.md production_docker/DEPLOYMENT_GUIDE.md production_docker/start_docker.sh 2>/dev/null || true
```

Clean copied runtime artifacts:

```bash
rm -rf production_docker/logs production_docker/data production_docker/.env
```

## 2. Configure Environment

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

Keep these defaults unless there is a specific reason to change them:

- `VITE_API_BASE_URL=` for same-origin browser API calls through Nginx.
- `BACKEND_UPSTREAM=http://backend:3001` for internal Compose routing.
- `BACKEND_BIND_ADDRESS=127.0.0.1` so direct backend access is local-only.
- `QDRANT_URL=http://qdrant:6333` because the backend runs inside Compose.
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` for web-link scraping.

## 3. Start The Stack

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

The default frontend URL is:

```text
http://localhost:8080
```

Put TLS termination in front of that port for public traffic.

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

- Keep `production_docker/` ignored and do not commit it.
- Keep `production_docker/.env` server-local.
- Replace default database credentials before public exposure.
- Keep PostgreSQL and Qdrant off public networks.
- Keep direct backend binding on `127.0.0.1` unless there is a controlled reason to expose it.
- Review the default admin bootstrap behavior before broad production use.
