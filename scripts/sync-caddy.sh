#!/usr/bin/env bash
# sync-caddy.sh — re-assert the animals.ashbi.ca block on
# /opt/caddy/Caddyfile. Idempotent. Skips the restart (Caddy's
# on-demand TLS auto-issues a cert in ~5s for new hostnames).
#
# v60 migration note: the fleet transitioned to Traefik on
# 2026-06-14, but a sibling project's deploy brought Caddy
# back on 2026-06-15 (probably they migrated off Traefik
# individually). The two reverse proxies coexist; Caddy is on
# :80/:443 and Traefik is on :8080/:8443. Caddy is what
# actually serves the public *.ashbi.ca routes because it's
# the one with the public certs (Traefik uses on-demand
# internal certs only).
#
# v62 reality: Caddy is back, the animals.ashbi.ca block is
# in /opt/caddy/Caddyfile, and this script ensures it stays
# there. Idempotent — running it again is a no-op.
#
# Usage:
#   scripts/sync-caddy.sh
#
# If the Caddyfile format ever changes (e.g. a sibling team's
# deploy rewrites it without animals.ashbi.ca), this script
# will re-append the block via caddy's API or file edit.
# Today: simple file edit + a caddy reload via caddy
# run --resume if available, else systemctl restart caddy.

set -euo pipefail

VPS="${VPS:-hostinger}"
LIVE_CFG="/opt/caddy/Caddyfile"
CADDY_BIN="$(ssh "$VPS" 'which caddy' 2>/dev/null || echo '')"

# Inline Python via stdin (avoids heredoc-escape hell).
cat <<'PYEOF' | ssh -T "$VPS" python3
import re, sys
LIVE_CFG = "/opt/caddy/Caddyfile"
HOST = "animals.ashbi.ca"
PORT = 3015

with open(LIVE_CFG) as f:
    s = f.read()

# Idempotency: if a block already exists for animals.ashbi.ca
# that forwards to port 3015, no-op.
if re.search(r"^animals\.ashbi\.ca\s*\{[^}]*reverse_proxy\s+127\.0\.0\.1:" + str(PORT), s, re.MULTILINE | re.DOTALL):
    print("[sync-caddy] animals.ashbi.ca → :3015 block already present, no-op")
    sys.exit(0)

# Find a clean insertion point: at the end of the file, after
# any trailing block close. Append with a leading blank line
# for readability.
block = (
    "\n"
    "# Animal Farts PWA (PootBox) — re-asserted by scripts/sync-caddy.sh\n"
    f"{HOST} {{\n"
    f"  reverse_proxy 127.0.0.1:{PORT}\n"
    "}\n"
)
s = s.rstrip() + "\n" + block

with open(LIVE_CFG, "w") as f:
    f.write(s)
print("[sync-caddy] animals.ashbi.ca → :3015 block appended")
PYEOF

# Reload Caddy. Caddy 2.x supports `caddy reload` if the
# admin API is enabled, but on this host it isn't (the
# systemd unit doesn't expose the admin port). Fall back to
# `systemctl restart caddy`. Brief downtime.
echo "[sync-caddy] reloading Caddy…"
ssh "$VPS" 'systemctl restart caddy 2>&1' || {
  echo "[sync-caddy] caddy restart failed — check journal" >&2
  exit 1
}
sleep 2
ssh "$VPS" 'systemctl is-active caddy' || {
  echo "[sync-caddy] caddy not active after restart" >&2
  exit 1
}

# Probe the live site.
echo "[sync-caddy] checking live site…"
for path in / /api/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "https://animals.ashbi.ca$path" 2>&1)
  echo "  $code  GET $path"
done
