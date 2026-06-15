#!/usr/bin/env python3
"""Write the Traefik dynamic routers config including the
animal-farts entry. Idempotent: appends the animal-farts block
if missing, leaves existing entries alone.

The Traefik config uses the traefik_http entrypoint (plain HTTP
on 127.0.0.1:8880) for the animal-farts route. The Caddy
reverse_proxy in front of Traefik terminates the public TLS
itself (Caddy has the animals.ashbi.ca cert in its in-memory
on-demand cert cache). The loopback hop from Caddy to Traefik
on :8880 is plain HTTP — no attacker in between, no TLS needed
on the private wire.

Why traefik_http (not traefik_https)? Traefik's HTTPS
entrypoint would need a cert for animals.ashbi.ca. Caddy has
the cert in its memory store, but Caddy's admin API is
path-restricted and we can't extract the .key without
restarting Caddy with full admin access. Plain HTTP on the
loopback hop is the simpler, equivalent solution.
"""
import re, sys, pathlib

PATH = pathlib.Path("/opt/traefik/dynamic/routers.yml")
HOST = "animals.ashbi.ca"
SVC = "animal-farts"
PORT = 3015
ENTRYPOINT = "traefik_http"

# Build the new content. We rewrite the file (with the new
# animal-farts blocks added/updated) and let Traefik hot-reload
# via its file provider's watch: true.
content = PATH.read_text()

# 1. If the animal-farts block already exists, no-op.
if f"service: {SVC}" in content:
    print(f"[sync-traefik] {SVC} block already present in {PATH}, no-op")
    sys.exit(0)

# 2. Insert the router after splash (the last existing entry).
ROUTER_ANCHOR = "    splash:\n"
ROUTER_INSERT = (
    f"    {SVC}:\n"
    f"      rule: \"Host(`{HOST}`)\"\n"
    f"      entryPoints:\n"
    f"        - {ENTRYPOINT}\n"
    f"      service: {SVC}\n"
)
if ROUTER_ANCHOR not in content:
    print(f"[sync-traefik] ROUTER_ANCHOR {ROUTER_ANCHOR!r} not found in {PATH}", file=sys.stderr)
    sys.exit(1)

# 3. Insert the service after splash's service (look for the
# last "url: ..." line in the file).
SERVICE_ANCHOR = '          - url: "http://127.0.0.1:3042"\n'
SERVICE_INSERT = (
    f"    {SVC}:\n"
    f"      loadBalancer:\n"
    f"        servers:\n"
    f'          - url: "http://127.0.0.1:{PORT}"\n'
)
if SERVICE_ANCHOR not in content:
    print(f"[sync-traefik] SERVICE_ANCHOR not found in {PATH}", file=sys.stderr)
    sys.exit(1)

content = content.replace(ROUTER_ANCHOR, ROUTER_ANCHOR + ROUTER_INSERT)
content = content.replace(SERVICE_ANCHOR, SERVICE_ANCHOR + SERVICE_INSERT)

PATH.write_text(content)
print(f"[sync-traefik] {SVC} block added; Traefik will hot-reload via file provider")
