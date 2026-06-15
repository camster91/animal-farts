#!/usr/bin/env python3
"""Update /opt/caddy/Caddyfile (the active Caddy config) so
animals.ashbi.ca forwards to Traefik's plain-HTTP entrypoint
on 127.0.0.1:8880 instead of direct-to-container :3015.

Caddy terminates the public TLS (it has the animals.ashbi.ca
cert in its in-memory on-demand cert cache). The loopback
hop from Caddy to Traefik on :8880 is plain HTTP — no
attacker on the private wire, no TLS needed.

Idempotent: skips the block if it already forwards to :8880.
"""
import re, sys, pathlib

PATH = pathlib.Path("/opt/caddy/Caddyfile")
HOST = "animals.ashbi.ca"

# Two acceptable forms:
#   (a) forwarding to Traefik (the post-migration form)
#   (b) forwarding to :3015 (the pre-migration form, will be replaced)
FORMS = {
    "traefik": re.compile(
        rf"^{re.escape(HOST)}\s*\{{[^}}]*reverse_proxy\s+127\.0\.0\.1:8880",
        re.MULTILINE | re.DOTALL,
    ),
    "container": re.compile(
        rf"^{re.escape(HOST)}\s*\{{[^}}]*reverse_proxy\s+127\.0\.0\.1:3015",
        re.MULTILINE | re.DOTALL,
    ),
    "exists": re.compile(
        rf"^{re.escape(HOST)}\s*\{{",
        re.MULTILINE,
    ),
}

content = PATH.read_text()

# Already in traefik form? No-op.
if FORMS["traefik"].search(content):
    print(f"[sync-caddy] {HOST} already forwards to Traefik :8880, no-op")
    sys.exit(0)

# Block exists but in container form. Replace the whole block
# with the traefik form. We match the full block including the
# closing brace so the rewrite is clean.
block_re = re.compile(
    rf"^{re.escape(HOST)}\s*\{{[^}}]*\}}",
    re.MULTILINE,
)
m = block_re.search(content)
if m is None:
    print(f"[sync-caddy] {HOST} block not found in {PATH}", file=sys.stderr)
    sys.exit(1)

new_block = (
    f"# {HOST} — PootBox (animal-farts PWA).\n"
    f"# v62 migration: forward to Traefik (the fleet's back-end\n"
    f"# router). Caddy terminates the public TLS, Traefik routes\n"
    f"# the request to the animal-farts container on :3015. The\n"
    f"# loopback hop is plain HTTP — no attacker in between.\n"
    f"{HOST} {{\n"
    f"  reverse_proxy 127.0.0.1:8880 {{\n"
    f"    header_up Host {{host}}\n"
    f"  }}\n"
    f"}}\n"
)
content = content[:m.start()] + new_block + content[m.end():]
PATH.write_text(content)
print(f"[sync-caddy] {HOST} block rewritten to forward to Traefik :8880")
