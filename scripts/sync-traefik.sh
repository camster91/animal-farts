#!/usr/bin/env bash
# sync-traefik.sh — re-assert the animals.ashbi.ca entry in
# /opt/traefik/dynamic.yml on the host. Idempotent.
#
# Why this is needed:
#   The fleet migrated from Caddy to Traefik v2.x (2026-06-14).
#   Traefik is bound to :80 and :443 on the host. Caddy is dead
#   (bind fails). The animal-farts subdomain's route lives in
#   /opt/traefik/dynamic.yml (lull + lull-relay + animal-farts).
#   Traefik watches the file via its dynamic-file provider and
#   hot-reloads — no restart needed.
#
#   This script ensures the animal-farts block is present. Idempotent.
#
# Usage:
#   scripts/sync-traefik.sh

set -euo pipefail

VPS="${VPS:-hostinger}"
LIVE_CFG="/opt/traefik/dynamic.yml"
ANIMALS_PORT=3015

# 1. Compute the desired block in Python (avoiding heredoc escape
# hell) and pipe it to the host.
#
# Strategy: read the live file, check if the block exists, and
# if not, insert it after the lull-relay anchors.

# Inline the Python via stdin pipe (not heredoc, to avoid bash
# escaping the $ inside f-strings).
cat <<'PYEOF' | ssh -T "$VPS" python3
import sys
LIVE_CFG = "/opt/traefik/dynamic.yml"
ANIMALS_PORT = 3015
HOST = "animals.ashbi.ca"

with open(LIVE_CFG) as f:
    s = f.read()

# Idempotency: check for the exact router block.
if "rule: \"Host(`animals.ashbi.ca`)\"" in s and "service: animal-farts" in s:
    print("[sync-traefik] animals.ashbi.ca block already present, no-op")
    sys.exit(0)

# Anchors: copy the existing lull-relay router and service blocks
# exactly. Use a multi-line literal so the spaces match.
# Note: the live file may use either the explicit-cert form
# (certResolver: letsencrypt) or the shorthand form (tls: {}).
# Both are valid Traefik configs. We try the explicit form first,
# fall back to the shorthand if not found.
ROUTER_ANCHORS = [
    (
        "    lull-relay:\n"
        "      rule: \"Host(`lull-relay.ashbi.ca`)\"\n"
        "      entryPoints:\n"
        "        - websecure\n"
        "      service: lull-relay\n"
        "      tls:\n"
        "        certResolver: letsencrypt"
    ),
    (
        "    lull-relay:\n"
        "      rule: \"Host(`lull-relay.ashbi.ca`)\"\n"
        "      entryPoints:\n"
        "        - websecure\n"
        "      service: lull-relay\n"
        "      tls: {}"
    ),
]
SERVICE_ANCHOR = (
    "    lull-relay:\n"
    "      loadBalancer:\n"
    "        servers:\n"
    "          - url: \"http://127.0.0.1:3020\""
)

# Idempotency: already present? Bail.
if "rule: \"Host(`animals.ashbi.ca`)\"" in s and "service: animal-farts" in s:
    print("[sync-traefik] animals.ashbi.ca block already present, no-op")
    sys.exit(0)

# Find which router anchor matches the live file.
router_anchor = None
for cand in ROUTER_ANCHORS:
    if cand in s:
        router_anchor = cand
        break
if router_anchor is None:
    print(f"[sync-traefik] no ROUTER_ANCHOR matched in {LIVE_CFG}", file=sys.stderr)
    sys.exit(1)
if SERVICE_ANCHOR not in s:
    print(f"[sync-traefik] SERVICE_ANCHOR not found in {LIVE_CFG}", file=sys.stderr)
    sys.exit(1)

# Match the tls form of the live file. The explicit-cert anchor has
# the certResolver line; the shorthand anchor has "tls: {}" instead.
# We append the matching form for the animal-farts block.
if "certResolver: letsencrypt" in router_anchor:
    tls_block = (
        "      tls:\n"
        "        certResolver: letsencrypt"
    )
else:
    tls_block = "      tls: {}"

ROUTER_INSERT = router_anchor + (
    "\n"
    "    animal-farts:\n"
    f"      rule: \"Host(`{HOST}`)\"\n"
    "      entryPoints:\n"
    "        - websecure\n"
    "      service: animal-farts\n"
    f"{tls_block}"
)
SERVICE_INSERT = SERVICE_ANCHOR + (
    "\n"
    "    animal-farts:\n"
    "      loadBalancer:\n"
    "        servers:\n"
    f"          - url: \"http://127.0.0.1:{ANIMALS_PORT}\""
)

s = s.replace(router_anchor, ROUTER_INSERT)
s = s.replace(SERVICE_ANCHOR, SERVICE_INSERT)

with open(LIVE_CFG, "w") as f:
    f.write(s)
print("[sync-traefik] animals.ashbi.ca block inserted, Traefik will hot-reload")
PYEOF

# 2. Probe the live site to confirm.
echo "[sync-traefik] live dynamic.yml sha256 (after):  $(ssh "$VPS" "sha256sum $LIVE_CFG 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo unknown)"
echo "[sync-traefik] checking live site…"
sleep 2
for path in / /api/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "https://animals.ashbi.ca$path" 2>&1)
  echo "  $code  GET $path"
done
