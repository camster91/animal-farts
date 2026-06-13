#!/usr/bin/env bash
# strip-animals-block.sh — strip any existing animals.ashbi.ca or
# *.ashbi.ca (wildcard) site block from /opt/caddy/Caddyfile.
#
# Extracted from sync-caddy.sh because the heredoc-quoting through
# `ssh "$VPS" "cat | ssh | awk ..."` was mangling the awk regex
# on the host (gawk vs mawk differ on the escape semantics). Running
# this as a self-contained script on the host avoids the quoting hell.
#
# Usage:
#   scp strip-animals-block.sh hostinger:/tmp/ && \
#     ssh hostinger 'bash /tmp/strip-animals-block.sh'
#
# The script is idempotent — running it multiple times does the same
# thing (removes all matching blocks, or does nothing if there are
# none). Exits 0 on success, 1 if the Caddyfile validation fails.

set -euo pipefail

LIVE_CFG="/opt/caddy/Caddyfile"

# Backup first.
cp -f "$LIVE_CFG" "${LIVE_CFG}.bak"

# Strip any site block that ALREADY covers animals.ashbi.ca:
#   - the explicit block (e.g. "animals.ashbi.ca {")
#   - the wildcard default (e.g. "*.ashbi.ca, ashbi.ca {")
# Both are about the same hostname once you expand the wildcard.
# The Caddyfile pattern is "<hostnames...> {" where <hostnames> is
# one or more space- or comma-separated hostnames. We only need
# to match the first one on the line.
awk '
  BEGIN { in_block = 0 }
  /^animals\.ashbi\.ca[ ,{]/ || /^\*\.ashbi\.ca[ ,{]/ {
    in_block = 1
    next
  }
  in_block == 1 {
    if ($0 ~ /^\}/) { in_block = 0; next }
    next
  }
  { print }
' "$LIVE_CFG" > "${LIVE_CFG}.tmp"

mv "${LIVE_CFG}.tmp" "$LIVE_CFG"

echo "[strip-animals-block] animals blocks remaining: $(grep -c 'animals\.ashbi\.ca {' "$LIVE_CFG" || echo 0)"
echo "[strip-animals-block] wildcard ashbi.ca blocks remaining: $(grep -cE '^\*\.ashbi\.ca[ ,{]' "$LIVE_CFG" || echo 0)"

# Validate
caddy validate --config "$LIVE_CFG" 2>&1 | tail -3
