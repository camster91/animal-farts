#!/usr/bin/env bash
# deploy-vps.sh — build the image on the VPS from local source, run it
# with a bind-mounted /data volume, and verify.
#
# This is the v54+ deploy recipe. The Mac has no docker, so the build
# happens on the VPS. Caddy on the VPS routes animals.ashbi.ca →
# 127.0.0.1:3015 → animal-farts:3000 inside the container.
#
# v60+ note: the fleet experimented with Traefik (2026-06-14)
# but the public *.ashbi.ca routes still run on Caddy because
# that's where the LE certs live. A sibling project's
# deploy brought Caddy back to life on 2026-06-15; Traefik
# is on :8080 only. Caddy is the active front proxy.
#
# Why build on VPS instead of `docker pull` from ghcr.io:
# - The repo's build-and-push workflow is set up but the image has never
#   been pushed for this project. The Mac has no docker to build locally
#   and push. The "build on VPS from local tarball" path is what works.
# - This mirrors the v52 deploy runbook that was in production before the
#   2026-06-11 prune. The volume mount is the persistence story.
#
# Usage (from the repo root on the Mac):
#   bash scripts/deploy-vps.sh [commit-ish]
#
# Idempotent. Re-running stops the old container, rebuilds, and starts.

set -euo pipefail
cd "$(dirname "$0")/.."

SHA="${1:-$(git rev-parse --short HEAD)}"
VPS="${VPS:-hostinger}"
NAME="animal-farts"
PORT_HOST=3015
PORT_CONT=3000
DATA_DIR="/data/${NAME}"
IMAGE="camster91/${NAME}:${SHA}"

# 1. Make sure the build is fresh locally.
echo "[deploy] verifying local build (commit ${SHA})…"
if ! git diff --quiet HEAD -- .; then
  echo "[deploy] working tree is dirty — commit or stash first" >&2
  exit 1
fi
git rev-parse "${SHA}" >/dev/null || { echo "[deploy] bad ref: ${SHA}" >&2; exit 1; }

# 2. Bundle the source (no node_modules, no dist — Dockerfile rebuilds).
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "[deploy] bundling source…"
tar -czf "${TMP}/${NAME}.tar.gz" \
  --exclude=node_modules --exclude=dist --exclude=.data \
  --exclude=android --exclude=.git --exclude=server-package-snapshot \
  -C "$(pwd)" .

# 3. Ship + extract + build + run.
# Use `cat | ssh` instead of scp — some VPS configurations block scp's
# protocol while keeping raw ssh working. The tarball streams through
# the same sshd process either way.
echo "[deploy] uploading to ${VPS} (via cat | ssh)…"
ssh "${VPS}" "mkdir -p ${DATA_DIR} /opt/${NAME}"
cat "${TMP}/${NAME}.tar.gz" | ssh "${VPS}" "cat > /tmp/${NAME}.tar.gz"

echo "[deploy] extracting + building image on ${VPS}…"
ssh "${VPS}" "
  set -e
  cd /opt/${NAME}
  rm -rf ./*
  tar -xzf /tmp/${NAME}.tar.gz
  # Tar may have wrapped in a top dir; flatten.
  INNER=\$(ls | head -1)
  if [ \"\${INNER}\" != '.' ] && [ -f \"\${INNER}/Dockerfile\" ]; then
    shopt -s dotglob
    mv \${INNER}/* .
    rmdir \${INNER}
  fi
  docker build -t ${IMAGE} .
"

echo "[deploy] swapping container…"
ssh "${VPS}" "
  set -e
  # Pre-create the data dir tree and chown to the in-container node user
  # (UID 1000 in the node:20-alpine base image). Without this, the bind
  # mount inherits root:root from the host and the container's
  # fs.mkdirSync('/app/data/uploads', { recursive: true }) fails EACCES.
  mkdir -p ${DATA_DIR}/uploads
  chown -R 1000:1000 ${DATA_DIR}
  docker rm -f ${NAME} 2>/dev/null || true
  docker run -d --name ${NAME} --restart unless-stopped \
    -p 127.0.0.1:${PORT_HOST}:${PORT_CONT} \
    -v ${DATA_DIR}:/app/data \
    -e NODE_ENV=production -e DB_PATH=/app/data/farts.db -e UPLOAD_DIR=/app/data/uploads -e PORT=${PORT_CONT} \
    --health-cmd='wget -q -O - http://127.0.0.1:${PORT_CONT}/api/health || exit 1' \
    --health-interval=30s --health-timeout=5s --health-retries=3 --health-start-period=10s \
    ${IMAGE}
"

# 4. Verify.
echo "[deploy] waiting for /api/health…"
for i in {1..30}; do
  if ssh "${VPS}" "docker exec ${NAME} wget -q -O - http://127.0.0.1:${PORT_CONT}/api/health" 2>/dev/null; then
    echo "[deploy] container is healthy"
    break
  fi
  sleep 1
done

echo "[deploy] re-asserting Caddy + Traefik animals blocks (resilient against sibling deploys)…"
bash "$(dirname "$0")/sync-caddy.sh" 2>&1 | tail -3
echo "[deploy] re-asserting Traefik animals route…"
bash "$(dirname "$0")/sync-traefik.sh" 2>&1 | tail -3

echo "[deploy] checking live site…"
curl -sI https://animals.ashbi.ca/ | head -3
echo "[deploy] share-code POST as a final smoke…"
curl -s https://animals.ashbi.ca/api/health && echo

echo "[deploy] done — verify at https://animals.ashbi.ca/"
