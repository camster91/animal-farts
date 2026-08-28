#!/usr/bin/env bash
# Promote the immutable GHCR image produced from an exact main commit.
# The VPS never rebuilds source. A verified backup and restore rehearsal run
# before the container swap, and failed validation restores the previous image.

set -euo pipefail
cd "$(dirname "$0")/.."

VPS="${VPS:-hostinger}"
SSH_KEY="${SSH_KEY:-}"
NAME="animal-farts"
PORT_HOST="3015"
PORT_CONT="3000"
DATA_DIR="/data/${NAME}"
REGISTRY_IMAGE="ghcr.io/camster91/${NAME}"

usage() {
  echo "usage: $0 <main-commit>" >&2
  exit 2
}

[[ $# -eq 1 ]] || usage
git diff --quiet HEAD -- . || {
  echo "[deploy] working tree is dirty; commit or stash it first" >&2
  exit 1
}

FULL_SHA="$(git rev-parse --verify "${1}^{commit}")" || usage
git merge-base --is-ancestor "$FULL_SHA" origin/main || {
  echo "[deploy] ${FULL_SHA} is not contained in origin/main" >&2
  exit 1
}
SHORT_SHA="${FULL_SHA:0:7}"
IMAGE="${REGISTRY_IMAGE}:main-${SHORT_SHA}"

SSH=(ssh)
if [[ -n "$SSH_KEY" ]]; then
  SSH+=(-i "$SSH_KEY")
fi
SSH+=("$VPS")

echo "[deploy] promoting ${IMAGE} (${FULL_SHA}) on ${VPS}"
"${SSH[@]}" bash -s -- "$IMAGE" "$FULL_SHA" "$NAME" "$PORT_HOST" "$PORT_CONT" "$DATA_DIR" <<'REMOTE'
set -euo pipefail

IMAGE="$1"
FULL_SHA="$2"
NAME="$3"
PORT_HOST="$4"
PORT_CONT="$5"
DATA_DIR="$6"
PUBLIC_ORIGIN="https://animals.ashbi.ca"
RELEASE_DIR="${DATA_DIR}/releases"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RECORD="${RELEASE_DIR}/${STAMP}-${FULL_SHA:0:12}.env"

command -v docker >/dev/null
command -v curl >/dev/null
command -v jq >/dev/null
for helper in animal-farts-backup animal-farts-restore-rehearsal animal-farts-ops-check; do
  test -x "/usr/local/sbin/${helper}"
done

mkdir -p "$RELEASE_DIR" "${DATA_DIR}/uploads"
chmod 0700 "$RELEASE_DIR"
chown -R 1000:1000 "${DATA_DIR}/uploads"

PREVIOUS_IMAGE="$(docker inspect "$NAME" --format '{{.Config.Image}}')"
PREVIOUS_ID="$(docker inspect "$NAME" --format '{{.Image}}')"
PREVIOUS_DIGEST="$(docker image inspect "$PREVIOUS_ID" --format '{{index .RepoDigests 0}}')"

echo "[deploy] pulling commit-addressed artifact"
docker pull "$IMAGE"
NEW_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"
NEW_DIGEST="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}')"
NEW_REVISION="$(docker image inspect "$IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
[[ "$NEW_REVISION" == "$FULL_SHA" ]] || {
  echo "[deploy] image revision mismatch: expected ${FULL_SHA}, got ${NEW_REVISION}" >&2
  exit 1
}
[[ "$NEW_DIGEST" == *@sha256:* ]] || {
  echo "[deploy] pulled image has no immutable repository digest" >&2
  exit 1
}

echo "[deploy] creating verified pre-release backup"
BACKUP_OUTPUT="$(/usr/local/sbin/animal-farts-backup)"
printf '%s\n' "$BACKUP_OUTPUT"
BACKUP_ARCHIVE="$(printf '%s\n' "$BACKUP_OUTPUT" | sed -n 's/^BACKUP_ARCHIVE=//p' | tail -1)"
[[ -n "$BACKUP_ARCHIVE" && -f "$BACKUP_ARCHIVE" ]]
/usr/local/sbin/animal-farts-restore-rehearsal "$BACKUP_ARCHIVE"

rollback() {
  local status=$?
  trap - ERR
  echo "[deploy] validation failed; restoring ${PREVIOUS_IMAGE} (${PREVIOUS_ID})" >&2
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    -p "127.0.0.1:${PORT_HOST}:${PORT_CONT}" \
    -v "${DATA_DIR}:/app/data" \
    -e NODE_ENV=production -e DB_PATH=/app/data/farts.db \
    -e UPLOAD_DIR=/app/data/uploads -e PORT="$PORT_CONT" \
    "$PREVIOUS_ID" >/dev/null
  curl --fail --silent --show-error --retry 20 --retry-delay 1 \
    "http://127.0.0.1:${PORT_HOST}/api/health" >/dev/null
  exit "$status"
}
trap rollback ERR

docker rm -f "$NAME" >/dev/null
docker run -d --name "$NAME" --restart unless-stopped \
  -p "127.0.0.1:${PORT_HOST}:${PORT_CONT}" \
  -v "${DATA_DIR}:/app/data" \
  -e NODE_ENV=production -e DB_PATH=/app/data/farts.db \
  -e UPLOAD_DIR=/app/data/uploads -e PORT="$PORT_CONT" \
  "$NEW_DIGEST" >/dev/null

curl --fail --silent --show-error --retry 30 --retry-delay 1 \
  "http://127.0.0.1:${PORT_HOST}/api/health" | jq -e '.ok == true' >/dev/null
curl --fail --silent --show-error "${PUBLIC_ORIGIN}/" | grep -qi '<html'
curl --fail --silent --show-error "${PUBLIC_ORIGIN}/api/recordings" | \
  jq -e '.recordings | type == "array"' >/dev/null
curl --fail --silent --show-error "${PUBLIC_ORIGIN}/manifest.webmanifest" | jq -e '.name' >/dev/null
curl --fail --silent --show-error "${PUBLIC_ORIGIN}/sw.js" | grep -q 'CACHE_NAME'
curl --fail --silent --show-error "${PUBLIC_ORIGIN}/api/health" | jq -e '.ok == true' >/dev/null
/usr/local/sbin/animal-farts-ops-check

FIRST_AUDIO="$(curl --fail --silent --show-error "${PUBLIC_ORIGIN}/api/recordings" | jq -r '.recordings | map(.audioUrl // empty) | first // empty')"
if [[ -n "$FIRST_AUDIO" ]]; then
  curl --fail --silent --show-error --range 0-31 "${PUBLIC_ORIGIN}${FIRST_AUDIO}" >/dev/null
fi

trap - ERR
umask 077
{
  printf 'DEPLOYED_AT=%q\n' "$STAMP"
  printf 'COMMIT_SHA=%q\n' "$FULL_SHA"
  printf 'IMAGE=%q\n' "$IMAGE"
  printf 'IMAGE_ID=%q\n' "$NEW_ID"
  printf 'IMAGE_DIGEST=%q\n' "$NEW_DIGEST"
  printf 'PREVIOUS_IMAGE=%q\n' "$PREVIOUS_IMAGE"
  printf 'PREVIOUS_IMAGE_ID=%q\n' "$PREVIOUS_ID"
  printf 'PREVIOUS_IMAGE_DIGEST=%q\n' "$PREVIOUS_DIGEST"
  printf 'BACKUP_ARCHIVE=%q\n' "$BACKUP_ARCHIVE"
} >"$RECORD"
chmod 0600 "$RECORD"

echo "[deploy] release verified"
echo "[deploy] digest=${NEW_DIGEST}"
echo "[deploy] rollback_image=${PREVIOUS_ID}"
echo "[deploy] backup=${BACKUP_ARCHIVE}"
echo "[deploy] record=${RECORD}"
REMOTE
