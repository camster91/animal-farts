#!/usr/bin/env bash
# sync-caddy.sh — bash wrapper for sync-caddy.py
#
# Rewrites /opt/caddy/Caddyfile from the v68 curated template.
# Idempotent. Restarts Caddy. Resilient to repeated runs.
#
# Usage: scripts/sync-caddy.sh
# The Python is copied to the host + run there. Avoids heredoc
# escaping hell. sed -n strips nothing (the file is shipped
# with the shebang intact) so the docstring is preserved.

set -euo pipefail
VPS="${VPS:-hostinger}"
SCRIPT="$(mktemp)"
trap 'rm -f "$SCRIPT"' EXIT

# Copy the Python file to the host (full file, including
# the shebang). The fallback chain: scp first, then cat |
# ssh (for hosts where scp is blocked — same workaround as
# lull-caddy-guard uses).
cat "$(dirname "$0")/sync-caddy.py" > "$SCRIPT"
scp -o BatchMode=yes "$SCRIPT" "$VPS":/tmp/sync-caddy.py 2>/dev/null || \
  cat "$SCRIPT" | ssh -o BatchMode=yes "$VPS" "cat > /tmp/sync-caddy.py"
ssh -o BatchMode=yes "$VPS" "python3 /tmp/sync-caddy.py"
rm -f "$SCRIPT" ssh -o BatchMode=yes "$VPS":/tmp/sync-caddy.py 2>/dev/null || true
