#!/bin/sh
set -eu

if [ "${RUN_PRISMA_MIGRATIONS:-true}" = "true" ]; then
  pnpm exec prisma migrate deploy
fi

exec "$@"
