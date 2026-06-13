# Deployment Guide

This guide describes the current practical deployment shape for Lumiere.
It is written for the code that exists in this repository today:

- `frontend/` is a Vite-built SPA
- `backend/` is a Next.js API service
- PostgreSQL stores application data
- Qdrant stores retrieval vectors
- uploaded notebook files are stored on local disk by default

The simplest supported production model is a single Linux host with:

1. an nginx or Caddy reverse proxy
2. the frontend served as static files
3. the backend running as a long-lived Node.js process on port `3001`
4. PostgreSQL and Qdrant reachable from the backend
5. a persistent directory mounted for notebook uploads

For a containerized single-host deployment, use the root deployment setup guide:
[`DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md).

## Current deployment architecture

Browser traffic should be routed like this:

- `/` and frontend routes such as `/dashboard` or `/notebooks` -> frontend static build
- `/api/*` -> backend `http://127.0.0.1:3001`
- `/uploads/*` -> backend `http://127.0.0.1:3001`

That matches the current frontend behavior:

- the SPA uses same-origin `/api/...` calls by default
- auth uses HTTP-only cookies
- file previews and uploaded assets are served from `/uploads/...`

## Prerequisites

Recommended server baseline:

- Ubuntu 22.04+ or similar Linux host
- Node.js `20+`
- `pnpm 10`
- nginx or Caddy
- PostgreSQL
- Qdrant
- `ffmpeg` and `ffprobe` if you want video uploads
- `yt-dlp` if you want public single-video YouTube link ingestion
- Chromium or Chrome if you want web-link scraping; set `PUPPETEER_EXECUTABLE_PATH` when Puppeteer cannot use a bundled browser

The backend startup health checks can fail boot when required dependencies are missing or unreachable.

## Runtime dependencies

### Required for a minimal working deployment

These are required for the backend to start successfully in the current codebase:

- `DATABASE_URL`
- `EMBEDDING_API_BASE`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`
- `QDRANT_URL`
- `QDRANT_COLLECTION`

Also required operationally:

- writable upload storage at `NOTEBOOK_UPLOAD_ROOT` or the default `backend/public/uploads/notebooks`

### Optional but important

These unlock major features and are strongly recommended:

- grounded chat and file summaries:
  - `CHAT_API_KEY`
  - `CHAT_API_BASE_URL` optional, defaults to `https://api.openai.com/v1`
  - `CHAT_MODEL`
- audio and video transcription:
  - `STT_API_BASE`
  - `STT_API_KEY`
  - `STT_MODEL`
- image and video frame descriptions:
  - `VLM_API_KEY`
  - `VLM_API_BASE_URL` or `VLM_API_BASE`
  - `VLM_MODEL`
  - fallback is allowed to `CHAT_API_KEY` and `CHAT_MODEL`
- reranking:
  - `ENABLE_RERANKING=true`
  - `RERANKER_API_BASE`
  - `RERANKER_API_KEY`
  - `RERANKER_MODEL`
- YouTube notebook ingestion:
  - install the `yt-dlp` system binary
  - `YOUTUBE_DOWNLOAD_TIMEOUT_MS` optional, defaults to 20 minutes

### Operational env vars

Useful production settings:

- `NODE_ENV=production`
- `FRONTEND_ORIGIN=https://yikang.org`
- `SESSION_COOKIE_SAME_SITE=lax` for the recommended same-origin reverse-proxy setup
- `SESSION_COOKIE_SAME_SITE=none` when `VITE_API_BASE_URL` points to a backend on a different origin; the backend must be served over HTTPS
- `NOTEBOOK_UPLOAD_ROOT=/var/lib/lumiere/uploads/notebooks`
- `QDRANT_API_KEY=...` if your Qdrant instance requires it
- `BACKEND_LOG_LEVEL=info`
- `STARTUP_HEALTH_PROVIDER_TIMEOUT_MS=15000`
- `CHAT_API_TIMEOUT_MS=120000` for grounded chat generation
- `SUMMARY_REQUEST_TIMEOUT_MS=...` if summaries need a longer timeout
- `VIDEO_SEGMENT_SECONDS=30`
- `VIDEO_MAX_FRAMES=60`
- `VIDEO_COMMAND_TIMEOUT_MS=120000`

### Auth cookies

The frontend sends all API requests with credentials, and the backend stores login state in the HTTP-only `lumiere_session` cookie.

For the recommended deployment where `/api/*` is reverse-proxied under the same public origin as the SPA, keep `SESSION_COOKIE_SAME_SITE=lax` and leave `VITE_API_BASE_URL` unset.

If the SPA is deployed at one origin and calls the backend through `VITE_API_BASE_URL` at another origin, set:

- backend `FRONTEND_ORIGIN` to the exact SPA origin, for example `https://app.example.com`
- backend `SESSION_COOKIE_SAME_SITE=none`
- frontend `VITE_API_BASE_URL` to the exact backend origin, for example `https://api.example.com`

Without `SESSION_COOKIE_SAME_SITE=none`, browsers can accept the login response but omit the session cookie from notebook fetches, which surfaces as `Notebook API error: authentication required`.

## Filesystem and persistence

By default, uploads are written under:

- `backend/public/uploads/notebooks`

For production, set:

- `NOTEBOOK_UPLOAD_ROOT=/var/lib/lumiere/uploads/notebooks`

and make sure the backend service user can write to that path.

Persist these storage layers:

- PostgreSQL data
- Qdrant data
- notebook upload directory

If you do not persist the upload directory, uploaded files will disappear across redeploys or host replacement.

## Database and vector store

You have two reasonable options.

### Option 1: managed or external services

Use:

- a managed PostgreSQL instance
- a managed or remote Qdrant instance

Then point the backend at them with:

- `DATABASE_URL`
- `QDRANT_URL`
- `QDRANT_API_KEY` if needed

This is the cleanest production setup.

### Option 2: local services on the same host

The repository root `docker-compose.yml` already runs:

- PostgreSQL
- pgAdmin
- Qdrant

Start them with:

```bash
pnpm db:up
```

For a host-run backend, keep:

```env
QDRANT_URL=http://localhost:6333
```

Do not use `http://qdrant:6333` unless the backend itself is running inside the same Docker Compose network.

## Build and release flow

From the repository root:

```bash
pnpm install
pnpm build:frontend
pnpm build:backend
```

Apply database migrations before starting the new backend version:

```bash
pnpm --dir backend exec prisma migrate deploy
```

If Prisma client generation is needed in your release flow:

```bash
pnpm --dir backend prisma:generate
```

## Frontend deployment

Build output is generated at:

- `frontend/dist/`

You can serve that directory directly from nginx or Caddy.

The frontend normally expects same-origin `/api` access, so the simplest production setup is:

- serve `frontend/dist`
- reverse proxy `/api` and `/uploads` to the backend
- leave `VITE_API_BASE_URL` unset

Set `VITE_API_BASE_URL` only if the browser must call the backend on a different public origin.

## Backend deployment

Build and run the backend from `backend/`:

```bash
pnpm --dir backend build
pnpm --dir backend start
```

The backend starts on port `3001`.

In production, run it under `systemd`, `pm2`, Docker, or another process supervisor. `systemd` is the simplest default.

## Example systemd service

Example `/etc/systemd/system/lumiere-backend.service`:

```ini
[Unit]
Description=Lumiere backend
After=network.target

[Service]
Type=simple
User=lumiere
Group=lumiere
WorkingDirectory=/srv/lumiere/backend
Environment=NODE_ENV=production
EnvironmentFile=/srv/lumiere/backend/.env
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lumiere-backend
sudo systemctl status lumiere-backend
```

## Example nginx configuration

Example server block:

```nginx
server {
    listen 80;
    server_name yikang.org;

    root /srv/lumiere/frontend/dist;
    index index.html;

    location /api/ {
        client_max_body_size 100m;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        client_max_body_size 100m;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

The application accepts notebook uploads up to 100 MB. Keep every public proxy
in front of the backend at the same limit or higher; the default nginx limit is
1 MB and will return `413 Request Entity Too Large` before the Next.js upload
route runs.

Add TLS with Let’s Encrypt or terminate TLS at your platform load balancer.

## Deployment sequence

A practical release flow looks like this:

1. Provision PostgreSQL, Qdrant, and the upload directory.
2. Install `ffmpeg` and `ffprobe` if video uploads are required.
3. Install Chromium or Chrome and set `PUPPETEER_EXECUTABLE_PATH` if web-link scraping is required.
3. Copy the repo to the server.
4. Create `backend/.env` from `backend/.env.example` and fill the real values.
5. Run `pnpm install`.
6. Run `pnpm build:frontend` and `pnpm build:backend`.
7. Run `pnpm --dir backend exec prisma migrate deploy`.
8. Publish `frontend/dist` to the web root.
9. Start or restart the backend service.
10. Reload nginx or Caddy.

## Verification checklist

After deployment, verify:

- frontend loads at `/`
- `GET /api/health` returns success
- `GET /api/openapi.json` returns the OpenAPI document
- `GET /api` loads Swagger UI
- login works and sets the `lumiere_session` cookie
- notebook creation works
- file upload writes into the configured upload directory
- retrieval and notebook chat work

If video support is expected, also verify:

- `ffmpeg -version`
- `ffprobe -version`
- an actual video upload completes end-to-end

## Security notes

Current codebase realities to account for:

- the default admin account is created automatically:
  - email: `admin@lumiere.my`
  - password: `admin1234`
- cookies are marked `Secure` only when `NODE_ENV=production`
- CORS currently uses `FRONTEND_ORIGIN` and otherwise falls back to `*`

For any public deployment:

1. set `NODE_ENV=production`
2. set `FRONTEND_ORIGIN` to the real frontend origin
3. restrict database and Qdrant network exposure
4. protect `.env` files and service credentials
5. plan to replace or harden the default admin bootstrap behavior before broader production use

## Known limitations of the current deployment model

These are not blockers, but they matter operationally:

- uploads are stored on local disk, so horizontal scaling is not ready without shared storage
- startup health can block backend boot if providers are unavailable
- video processing is synchronous and can make uploads slow

## Related docs

- [DEPLOYMENT_GUIDE.md](/home/arch_Kang/projects/Lumiere-v2/DEPLOYMENT_GUIDE.md)
- [architecture-overview.md](/home/arch_Kang/projects/Lumiere-v2/docs/architecture-overview.md)
- [rag-processing.md](/home/arch_Kang/projects/Lumiere-v2/docs/rag-processing.md)
- [video-processing.md](/home/arch_Kang/projects/Lumiere-v2/docs/video-processing.md)
- [auth-workspaces.md](/home/arch_Kang/projects/Lumiere-v2/docs/auth-workspaces.md)
