#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] running database migrations..."
alembic upgrade head

echo "[entrypoint] starting uvicorn..."
RELOAD_FLAG=""
if [ "${BACKEND_RELOAD:-1}" = "1" ]; then
  RELOAD_FLAG="--reload"
fi
exec uvicorn app.main:app \
  --host "${BACKEND_HOST:-0.0.0.0}" \
  --port "${BACKEND_PORT:-8000}" \
  --proxy-headers \
  ${RELOAD_FLAG}
