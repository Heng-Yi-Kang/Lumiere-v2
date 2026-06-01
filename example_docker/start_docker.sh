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
  echo "Created .env from .env.example. Review BACKEND_UPSTREAM before production use."
fi

set -a
. ./.env
set +a

mkdir -p logs/nginx

docker compose build
docker compose up -d

echo
echo "Lumiere frontend is starting."
echo "Frontend: http://localhost:${FRONTEND_PORT:-8080}"
echo "Proxy upstream: ${BACKEND_UPSTREAM:-http://host.docker.internal:3001}"
echo
docker compose ps
