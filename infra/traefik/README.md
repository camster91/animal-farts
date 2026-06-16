# Traefik cutover (v74 setup, v75 complete)

This directory contains the Traefik config that the v74 turn
left on the host. The goal was to route `animals.ashbi.ca`
through Traefik (TLS terminated by Traefik using the existing
LE cert) instead of Caddy terminating TLS and reverse-proxying
to the container.

## v75 status: cutover complete for animals

The live path is now:

```
curl https://animals.ashbi.ca/ →
  Caddy :443 (public TLS terminator) →
  Traefik :8443 (loopback, re-terminates TLS using the
    animals.ashbi.ca cert from /opt/traefik/certs/) →
  animal-farts container :3015 (Express)
```

The other 9 *.ashbi.ca subdomains still go direct from Caddy
to their containers (lull/lull-relay/splash/hub/markup/
contractions/relay/photogen/arcan-painting). Only animals
goes through Traefik for now — full cutover would need
coordinating the lull/markup/contraction/splash caddy-guard
crons to no-op or be deleted.

## What was done

1. **Cert staging**: The animals cert (and lull + lull-relay
   certs) was copied from Caddy's on-disk store
   (`/root/.local/share/caddy/certificates/...`) to
   `/opt/traefik/certs/animals.ashbi.ca.{crt,key}`. The cert
   is valid until 2026-09-11 (90 days from LE issuance).

2. **Config files in place**:
   - `traefik.yml` (this dir) — Traefik's static config.
     entrypoints: `plain_http:8880` + `tls_https:8443`
     (loopback only, behind Caddy). File provider watches
     `/etc/traefik/dynamic`.
   - `routers.yml` (this dir) — 4 routes (animals + lull +
     lull-relay + splash), all using `tls_https` entrypoint.
   - `tls.yml` (this dir) — 3 certs (animals + lull +
     lull-relay) loaded by Traefik's cert store.

3. **On the host**, the same files are at:
   - `/opt/traefik/traefik.yml` (canonical, no symlink)
   - `/opt/traefik/dynamic/routers.yml`
   - `/opt/traefik/dynamic/tls.yml`
   - `/opt/traefik/certs/animals.ashbi.ca.{crt,key}`

4. **Traefik container running** as a sidecar:
   - `docker run -d --name traefik --restart unless-stopped
     --network host
     -v /etc/traefik:/etc/traefik
     -v /var/run/docker.sock:/var/run/docker.sock:ro
     traefik:v3.2`
   - The `--network host` flag is critical: without it, the
     container's `127.0.0.1` is the container's own loopback,
     not the host's, so the upstream dial fails with
     "connection refused". With `--network host`, the
     container shares the host's network namespace and
     `127.0.0.1:3015` correctly reaches the animal-farts
     container's exposed port.

5. **Caddy forwards animals → Traefik**:
   - The animals block in /opt/caddy/Caddyfile (curated by
     scripts/sync-caddy.py) was changed from
     `reverse_proxy 127.0.0.1:3015` to
     `reverse_proxy https://127.0.0.1:8443` with
     `tls_insecure_skip_verify` (loopback cert validation).

## How to verify

```sh
# from the host
curl -sk -H 'Host: animals.ashbi.ca' https://127.0.0.1:8443/
# should return the PootBox index.html

# from anywhere
curl -sI https://animals.ashbi.ca/
# should return HTTP/2 200 with server: Caddy (Caddy
# is still the public front on :443)
```

The Traefik debug log (`docker logs traefik`) shows the route
match (`Service selected by WRR: d50d8058... = animal-farts
backend`) when animals.ashbi.ca is requested.

## Next steps (not done)

1. **Coordinate the sibling caddy-guard crons** (lull,
   markup, contraction, splash) so they don't re-assert
   their Caddy blocks on the :443 port for hosts that
   should be Traefik-routed. Currently those crons add
   `lull.ashbi.ca`, `markup.ashbi.ca`, `contractions.ashbi.ca`,
   `splash.ashbi.ca` blocks to /opt/caddy/Caddyfile every
   minute. For a full cutover, those crons would need to
   no-op or be deleted from the sibling repos.

2. **Move the remaining 9 *.ashbi.ca subdomains to Traefik**.
   Each one needs (a) a route in `/opt/traefik/dynamic/routers.yml`
   (b) a cert in `/opt/traefik/certs/` (c) a Caddy block
   that forwards to Traefik. Pattern is identical to the
   animals block.

3. **Full Traefik-on-:443 cutover** (what the user
   actually asked for): the current setup has Caddy on
   :80/:443 (public). For Traefik to take over, Caddy
   needs to be stopped on :443, Traefik needs to be
   reconfigured to bind :443 directly (not just :8443),
   and the caddy-guard crons need to no-op. The lull
   AGENTS.md says the prior attempt to remove Caddy
   entirely caused multi-hour deadlocks with the
   caddy-guard crons — so this step is **not** a one-line
   change.
