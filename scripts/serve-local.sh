#!/usr/bin/env bash
# serve-local.sh — run the Animal Farts server exactly as the Docker
# container would, but on the Mac (no docker available locally).
#
# Mirrors Dockerfile env (PORT, NODE_ENV, DB_PATH, UPLOAD_DIR) so a "works
# locally" claim is equivalent to a "works in the container" claim.
#
# Usage:
#   scripts/serve-local.sh                  # bind 0.0.0.0:3000, fresh data
#   PORT=5182 scripts/serve-local.sh        # custom port
#   DATA_DIR=/tmp/afdata scripts/serve-local.sh
#   DATA_DIR=... scripts/serve-local.sh keep   # keep running after stop
#
# Notes:
# - Requires server/node_modules (run `npm install` in server/ once)
# - Requires dist/ built (`npm run build` in repo root)
# - Writes DB to $DATA_DIR/farts.db, uploads to $DATA_DIR/uploads
# - healthcheck: GET /api/health

set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
DATA_DIR="${DATA_DIR:-$PWD/.data}"
DB_PATH="${DB_PATH:-$DATA_DIR/farts.db}"
UPLOAD_DIR="${UPLOAD_DIR:-$DATA_DIR/uploads}"
NODE_ENV="${NODE_ENV:-production}"

mkdir -p "$DATA_DIR" "$UPLOAD_DIR"

echo "[serve-local] port=$PORT db=$DB_PATH uploads=$UPLOAD_DIR node_env=$NODE_ENV"

# 1. Make sure the SPA is built
if [[ ! -f dist/index.html ]]; then
  echo "[serve-local] dist/ missing — building…"
  npm run build
fi

# 2. Make sure server deps are installed
if [[ ! -d server/node_modules/express ]]; then
  echo "[serve-local] server deps missing — installing…"
  (cd server && npm install --omit=dev --no-audit --no-fund)
fi

# 3. Run the server
exec env \
  PORT="$PORT" \
  DB_PATH="$DB_PATH" \
  UPLOAD_DIR="$UPLOAD_DIR" \
  NODE_ENV="$NODE_ENV" \
  node server/server.js
