# Traefik cutover attempt (v74, 2026-06-15)

This directory contains the Traefik config that the v74 turn
left on the host. The goal was to route `animals.ashbi.ca`
through Traefik (TLS terminated by Traefik using the existing
LE cert) instead of Caddy terminating TLS and reverse-proxying
to the container.

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
     -p 127.0.0.1:8880:8880 -p 127.0.0.1:8443:8443
     -v /etc/traefik:/etc/traefik
     -v /var/run/docker.sock:/var/run/docker.sock:ro
     traefik:v3.2`

## Where it stands

Traefik loads the config (debug log shows all 4 routes added
with the certs loaded), but **the live path is still Caddy**.
The route-matching bug: a curl to `http://127.0.0.1:8880/`
with `Host: animals.ashbi.ca` returns 404, even though the
config inside the container has the route. The TLS port
(`https://127.0.0.1:8443/`) returns 400 Bad Request, suggesting
an ALPN/host issue. The current debug log shows the routes
loaded but doesn't log the rejected requests, making the
debug cycle slow.

## What's needed to finish the cutover

1. **Fix the route-matching bug**. Two paths to try:
   - Verify the `Host` header in the request actually matches
     the route's rule (maybe the `Host()` Host matcher needs
     trailing components, maybe a header normalization issue).
   - Move Traefik to bind to the actual public IP (not
     loopback) and configure Caddy to forward
     `animals.ashbi.ca` → Traefik via SNI.

2. **Update Caddy** to forward `animals.ashbi.ca` →
   `https://127.0.0.1:8443` (Traefik's HTTPS port) with
   `tls_insecure_skip_verify` (loopback cert validation).

3. **Coordinate with sibling caddy-guard crons** (lull,
   markup, contraction, splash) so they don't re-assert
   their blocks on the Caddy :443 port and block Traefik
   from getting traffic. The crons currently add Caddy
   blocks every minute; for a full cutover, those crons
   need to no-op or be deleted from the sibling repos.

4. **Fleet-wide Traefik-on-:443 cutover** (what the user
   actually asked for): the current setup has Caddy on
   :80/:443 (public). For Traefik to take over, Caddy
   needs to be stopped, and the VPS-level A-records need
   to stay pointed at the VPS IP. The lull AGENTS.md says
   the prior attempt to remove Caddy entirely caused
   multi-hour deadlocks with the caddy-guard crons — so
   this step is **not** a one-line change.

## Why I stopped

The live site has been up on Caddy for the entire turn. I
didn't want to leave the live path in a broken state while
iterating on Traefik. The site is currently 200 on all 5
live paths via Caddy → 127.0.0.1:3015.

## What the user can do

If the user wants the cutover completed in a future turn:
- Ask me to spend more time on debugging the route match
- Or ask the operator (the user's collaborators running the
  lull/markup/contraction/splash repos) to disable their
  caddy-guard crons for the duration of the cutover
- Or accept the half-step: Caddy → Traefik for animals
  only (preserves the sibling caddy-guard crons)
