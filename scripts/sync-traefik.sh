#!/usr/bin/env bash
# sync-traefik.sh — re-assert the animals.ashbi.ca entry on the
# /opt/traefik/dynamic.yml file. Idempotent. Skips the restart
# (Traefik hot-reloads dynamic config — `traefik.flag` is
# available if a forced restart is needed).
#
# Why this is needed:
#   The fleet migrated from Caddy to Traefik v2.x (started 2026-06-14).
#   Caddy is dead (bind to :443 fails — Traefik owns the port).
#   `/opt/traefik/dynamic.yml` is the source of truth for HTTP
#   routing. Each project (lull, lull-relay, animal-farts, ...)
#   has its own block there.
#
#   This script mirrors the animal-farts block into the live
#   dynamic.yml so the animal-farts PWA stays reachable. The
#   first run (or a sibling team's manual edit that wipes the
#   block) re-asserts it. Subsequent runs short-circuit when
#   the block is already present.
#
# Usage:
#   scripts/sync-traefik.sh
#
# This replaces the old scripts/sync-caddy.sh. The Caddy-era
# version of that script tried to restart the Caddy systemd
# service after editing /opt/caddy/Caddyfile — but Caddy is
# no longer the fleet's reverse proxy. This script does the
# Traefik equivalent: edit /opt/traefik/dynamic.yml, no restart
# needed (Traefik watches the file via its dynamic-file
# provider in /opt/traefik/traefik.yml).

set -euo pipefail

VPS="${VPS:-hostinger}"
LIVE_CFG="/opt/traefik/dynamic.yml"
ANIMALS_PORT=3015
SCRIPT_REMOTE="import re, sys
LIVE_CFG = '$LIVE_CFG'
ANIMALS_PORT = $ANIMALS_PORT
HOST = 'animals.ashbi.ca'

with open(LIVE_CFG) as f:
    s = f.read()

# Idempotency: if the service is already declared, no-op.
if re.search(r'^\s+service:\s*' + re.escape(HOST.split('.')[0]), s, flags=re.MULTILINE):
    # Check the entry: don't trust the hostname substring alone
    pass

if 'animal-farts:' in s and f'service: animal-farts' in s:
    print('[sync-traefik] animals.ashbi.ca block already present, no-op')
    sys.exit(0)

# Insert the router block right after lull-relay's router,
# and the service block right after lull-relay's service.
# The string anchors are exact copies of the existing lull-relay
# blocks in the file (see /opt/traefik/dynamic.yml on the host).
ROUTER_ANCHOR = '''    lull-relay:
      rule: \"Host(\`lull-relay.ashbi.ca\`)\"
      entryPoints:
        - websecure
      service: lull-relay
      tls:
        certResolver: letsencrypt'''
ROUTER_INSERT = ROUTER_ANCHOR + f'''
    animal-farts:
      rule: \"Host(\`{HOST}\`)\"
      entryPoints:
        - websecure
      service: animal-farts
      tls:
        certResolver: letsencrypt'''
SERVICE_ANCHOR = '''    lull-relay:
      loadBalancer:
        servers:
          - url: \"http://127.0.0.1:3020\"'''
SERVICE_INSERT = SERVICE_ANCHOR + f'''
    animal-farts:
      loadBalancer:
        servers:
          - url: \"http://127.0.0.1:{ANIMALS_PORT}\"'''

if ROUTER_ANCHOR not in s:
    print(f'[sync-traefik] anchor missing: {ROUTER_ANCHOR!r}', file=sys.stderr)
    sys.exit(1)
if SERVICE_ANCHOR not in s:
    print(f'[sync-traefik] anchor missing: {SERVICE_ANCHOR!r}', file=sys.stderr)
    sys.exit(1)

s = s.replace(ROUTER_ANCHOR, ROUTER_INSERT)
s = s.replace(SERVICE_ANCHOR, SERVICE_INSERT)

with open(LIVE_CFG, 'w') as f:
    f.write(s)
print('[sync-traefik] animals.ashbi.ca block inserted, Traefik will hot-reload')
"

echo "[sync-traefik] live dynamic.yml sha256 (before): $(ssh "$VPS" "sha256sum $LIVE_CFG 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo unknown)"

out=$(ssh "$VPS" "python3 - <<'PYEOF'
$SCRIPT_REMOTE
PYEOF
" 2>&1)
echo "$out" | head -10

echo "[sync-traefik] live dynamic.yml sha256 (after):  $(ssh "$VPS" "sha256sum $LIVE_CFG 2>/dev/null | cut -d' ' -f1" 2>/dev/null || echo unknown)"

# Probe the live site
echo "[sync-traefik] checking live site…"
sleep 2  # give Traefik a moment to hot-reload
for path in / /api/health; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 "https://animals.ashbi.ca$path" 2>&1)
  echo "  $code  GET $path"
done
