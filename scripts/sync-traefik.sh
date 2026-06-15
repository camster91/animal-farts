#!/usr/bin/env bash
# sync-traefik.sh — bash wrapper for sync-traefik.py
#
# Appends the animal-farts route + service to /opt/traefik/dynamic/routers.yml. Idempotent. Traefik hot-reloads via the file provider.
#
# Usage: scripts/sync-traefik.sh
# The Python is copied to the host + run there. Avoids heredoc
# escaping hell.

set -euo pipefail
VPS="${VPS:-hostinger}"
SCRIPT="$(mktemp)"
trap 'rm -f "$SCRIPT"' EXIT

# Copy the Python file body to the host (stripping the shebang).
sed -n '2,$p' "$(dirname "$0")/sync-traefik.py" > "$SCRIPT"
scp -o BatchMode=yes "$SCRIPT" "$VPS":/tmp/sync-traefik.py 2>/dev/null || \
  cat "$SCRIPT" | ssh -o BatchMode=yes "$VPS" "cat > /tmp/sync-traefik.py"
ssh -o BatchMode=yes "$VPS" "python3 /tmp/sync-traefik.py"
rm -f "$SCRIPT" ssh -o BatchMode=yes "$VPS":/tmp/sync-traefik.py 2>/dev/null || true
