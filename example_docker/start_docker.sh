#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found on PATH." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required but was not found." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Review credentials and provider settings before production use."
fi

set -a
. ./.env
set +a

missing_required=""
for name in EMBEDDING_API_BASE EMBEDDING_API_KEY EMBEDDING_MODEL; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    missing_required="${missing_required} ${name}"
  fi
done

if [ -n "$missing_required" ]; then
  echo "Missing required backend startup settings:${missing_required}" >&2
  echo "Set them in example_docker/.env before starting the deployment stack." >&2
  exit 1
fi

mkdir -p logs/nginx "${NOTEBOOK_UPLOAD_HOST_DIR:-./data/uploads/notebooks}"

docker compose build
docker compose up -d

echo
echo "Lumiere stack is starting."
echo "Frontend: http://localhost:${FRONTEND_PORT:-8080}"
echo "Backend: http://localhost:${BACKEND_PORT:-3001}"
echo "Proxy upstream: ${BACKEND_UPSTREAM:-http://backend:3001}"
echo
docker compose ps
