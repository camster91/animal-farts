#!/usr/bin/env bash
# sync-caddy.sh — bash wrapper for sync-caddy.py
#
# Rewrites the /opt/caddy/Caddyfile animals block to forward to Traefik on :8880. Idempotent. Restarts Caddy.
#
# Usage: scripts/sync-caddy.sh
# The Python is copied to the host + run there. Avoids heredoc
# escaping hell.

set -euo pipefail
VPS="${VPS:-hostinger}"
SCRIPT="$(mktemp)"
trap 'rm -f "$SCRIPT"' EXIT

# Copy the Python file body to the host (stripping the shebang).
sed -n '2,$p' "$(dirname "$0")/sync-caddy.py" > "$SCRIPT"
scp -o BatchMode=yes "$SCRIPT" "$VPS":/tmp/sync-caddy.py 2>/dev/null || \
  cat "$SCRIPT" | ssh -o BatchMode=yes "$VPS" "cat > /tmp/sync-caddy.py"
ssh -o BatchMode=yes "$VPS" "python3 /tmp/sync-caddy.py"
rm -f "$SCRIPT" ssh -o BatchMode=yes "$VPS":/tmp/sync-caddy.py 2>/dev/null || true
