#!/usr/bin/env bash
# sync-caddy.sh — re-assert the animals.ashbi.ca block on
# /opt/caddy/Caddyfile and reload Caddy.
#
# Why this is needed:
#   Cam's other projects (alinenasseh, jwhabits, tkd, arcan-painting)
#   each have their own deploy scripts that overwrite
#   /opt/caddy/Caddyfile with their own version. Every time one of
#   those deploys runs, it wipes the animals.ashbi.ca block (and the
#   arcan apex block, and the jw-habits block, etc.). The animal-farts
#   PWA then goes down until someone notices.
#
#   This script is intentionally destructive: it pulls the live file,
#   strips any existing animals.ashbi.ca block, re-appends the
#   canonical block from infra/caddy/Caddyfile, validates, and
#   restarts Caddy. It runs UNCONDITIONALLY — even if the file already
#   matches what we'd write, we still re-assert the block in case a
#   sibling deploy wiped it between runs.
#
#   The arcan-painting project has a sister script at
#   scripts/sync-caddy.sh that re-asserts ITS block. Run both.
#   Caddy's on_demand_tls means the cert for animals.ashbi.ca is
#   issued on first hit and cached, so this is safe to run as often
#   as we like.
#
# Usage:
#   scripts/sync-caddy.sh

set -euo pipefail
cd "$(dirname "$0")/.."

VPS="${VPS:-hostinger}"
REPO_CFG="$(pwd)/infra/caddy/Caddyfile"
LIVE_CFG="/opt/caddy/Caddyfile"

# The canonical animals.ashbi.ca block, in the same shape as in
# infra/caddy/Caddyfile.
read -r -d '' APEX_BLOCK <<'EOF' || true

# Animal Farts PWA (PootBox) — re-asserted 2026-06-13. Sibling
# deploys (alinenasseh / jwhabits / tkd / arcan-painting) overwrite
# /opt/caddy/Caddyfile and wipe this block. Re-added every sync.
animals.ashbi.ca {
  reverse_proxy 127.0.0.1:3015
}
EOF

# Step 1: capture the live file's SHA so we can short-circuit if the
# post-rewrite file is identical (i.e. the apex block was already
# there). The script is fast either way (~2s) but skipping the
# caddy restart when the file is unchanged avoids a 1s blip.
LIVE_SHA_BEFORE="$(ssh "$VPS" "sha256sum $LIVE_CFG 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo unknown)"

# Step 2: pull the live file, strip any existing animals.ashbi.ca
# block, re-append the canonical block.
echo "[sync-caddy] live Caddyfile sha256 (before): ${LIVE_SHA_BEFORE}"
echo "[sync-caddy] shipping rewrite script + animals block to ${VPS}…"
# Use a regular (non-strict) subshell for the remote rewrite so the
# local $VPS / $LIVE_CFG / $APEX_BLOCK heredoc variables expand in the
# local shell (not the remote). set -u is dropped inside the () block
# because the heredoc would otherwise error on unset local vars.
(
  set +e
  ssh "$VPS" "cat > /tmp/rewrite-caddy.sh" <<REMOTE_SCRIPT
set -e
LIVE_CFG="$LIVE_CFG"
# Backup first.
cp -f "\$LIVE_CFG" "\$LIVE_CFG.bak"
# Strip any existing animals.ashbi.ca block. The block ends at the
# closing '}' of the site stanza.
awk '
  BEGIN { in_block = 0 }
  # Strip any site block that ALREADY covers animals.ashbi.ca:
  #   - the explicit block (e.g. "animals.ashbi.ca {")
  #   - the wildcard default (e.g. "*.ashbi.ca, ashbi.ca {")
  # Both are about the same hostname once you expand the wildcard.
  /^animals\.ashbi\.ca( |\{|,)/ ||
  /^\*\.ashbi\.ca( |\{|,)/ {
    in_block = 1; next
  }
  in_block == 1 {
    if (\$0 ~ /^\}/) { in_block = 0; next }
    next
  }
  { print }
' "\$LIVE_CFG" > "\$LIVE_CFG.tmp"
mv "\$LIVE_CFG.tmp" "\$LIVE_CFG"
REMOTE_SCRIPT
)

# Append the block (use the local content via cat | ssh)
cat <<APEX | ssh "$VPS" "cat >> $LIVE_CFG"
$APEX_BLOCK
APEX

# Step 3: validate
echo "[sync-caddy] validating on host"
ssh "$VPS" "caddy validate --config $LIVE_CFG 2>&1 | tail -3"

# Step 4: short-circuit if the file is unchanged
LIVE_SHA_AFTER="$(ssh "$VPS" "sha256sum $LIVE_CFG 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo unknown)"
echo "[sync-caddy] live Caddyfile sha256 (after):  ${LIVE_SHA_AFTER}"
if [ "${LIVE_SHA_BEFORE}" = "${LIVE_SHA_AFTER}" ] && [ "${LIVE_SHA_BEFORE}" != "unknown" ]; then
  echo "[sync-caddy] no change to live Caddyfile — animals block was already present, skipping restart"
  exit 0
fi

# Step 5: restart
echo "[sync-caddy] restarting caddy"
ssh "$VPS" "systemctl restart caddy 2>&1"
sleep 2
ssh "$VPS" "systemctl is-active caddy" || {
  echo "[sync-caddy] caddy not active after restart — check journal" >&2
  exit 1
}

echo "[sync-caddy] done — animals.ashbi.ca block re-asserted"
