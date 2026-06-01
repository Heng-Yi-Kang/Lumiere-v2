# Lumiere Example Docker Deployment

This folder is a single-host Docker Compose example for deploying the Lumiere frontend behind Nginx.

It is adapted from `docs/EXAMPLE_DOCKER_DEPLOYMENT_STUDY.md`, but this repository is different from that study project: the deployable frontend is a Vite static build, so Nginx serves the compiled assets directly.

## Runtime Shape

- `frontend`: builds `frontend/` with pnpm and serves `dist/` through Nginx.
- Nginx exposes the public HTTP port and serves React Router routes with `index.html` fallback.
- Nginx proxies `/api/` and `/uploads/` to `BACKEND_UPSTREAM`.

By default, `BACKEND_UPSTREAM` is `http://host.docker.internal:3001`, matching the backend port used by this repo's backend workspace scripts.

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
- `BACKEND_UPSTREAM`: Nginx upstream for `/api/` and `/uploads/`.
- `VITE_API_BASE_URL`: optional build-time browser API base URL.

Leave `VITE_API_BASE_URL` empty for the recommended same-origin deployment. In that mode, browser requests go to `/api/...` on the frontend origin and Nginx forwards them to `BACKEND_UPSTREAM`.

## Backend Upstream Examples

Backend running on the Docker host:

```env
BACKEND_UPSTREAM=http://host.docker.internal:3001
```

Backend running as another Compose service on the same Docker network:

```env
BACKEND_UPSTREAM=http://backend:3001
```

Public backend URL reachable directly by the browser:

```env
VITE_API_BASE_URL=https://api.example.com
```

Use the public backend URL mode only when you intentionally do not want Nginx to keep API traffic on the frontend origin.

## Production Notes

- Put TLS termination in front of this Nginx container or extend the Nginx template with certificates.
- Keep `.env` server-local; do not commit secrets or environment-specific values.
- If the folder is renamed, update `dockerfile: example_docker/Dockerfile.frontend` in `docker-compose.yml`.
- Run `docker compose logs -f frontend` from this folder to inspect Nginx output.
