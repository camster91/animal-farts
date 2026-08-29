# Production ingress and TLS

Verified on the production VPS on 2026-08-28.

## Authoritative topology

Traefik is the only public edge and binds host ports 80 and 443. The
`animals.ashbi.ca` file-provider router terminates TLS, uses the `letsencrypt`
resolver, and proxies to the Animal Farts container on
`http://127.0.0.1:3015`. The container maps that loopback port to Express port
3000 and mounts `/data/animal-farts` at `/app/data`.

Canonical host files:

- `/opt/traefik/traefik.yml`: static entrypoints, providers, and ACME resolver.
- `/opt/traefik/dynamic/routers.yml`: fleet routers and services.
- `/opt/traefik/acme.json`: Traefik-managed ACME account/certificates, mode 0600.
- `/opt/traefik/dynamic/tls.yml`: exceptional static certificates only.

Repository files document the route but must not overwrite shared fleet
configuration wholesale. Change only the relevant production stanza and retain
a timestamped rollback copy.

## TLS ownership and renewal

Traefik's `letsencrypt` resolver is the sole owner for `animals.ashbi.ca`. It
uses Let's Encrypt production ACME with HTTP-01 on the public `web` entrypoint.
Traefik stores, renews, and hot-activates the certificate through
`/opt/traefik/acme.json`; no Certbot, Caddy, cron, or key-copy job is involved.

On 2026-08-28 the obsolete static animals pair was removed from
`dynamic/tls.yml`. Traefik obtained and activated a trusted certificate without
restarting the edge or sibling applications. The prior file is retained at
`/opt/traefik/dynamic/tls.yml.bak.animals-acme-20260828T171830Z`; the old pair
under `/opt/traefik/certs` remains available for rollback but is not loaded.
The new certificate is valid through 2026-11-26.

Validate externally:

```bash
curl --fail --silent https://animals.ashbi.ca/api/health
printf '' | openssl s_client -connect animals.ashbi.ca:443 \
  -servername animals.ashbi.ca 2>/dev/null | \
  openssl x509 -noout -subject -issuer -dates -fingerprint -sha256
```

`animal-farts-ops-check.timer` checks strict public health, externally served
certificate age, container health/restarts, capacity, and backup freshness
every five minutes. Certificate age below 30 days fails the check, covering the
30/14/7-day escalation windows until renewal succeeds.

## Rollback

If ACME serving fails, restore only the timestamped `tls.yml` backup to
`/opt/traefik/dynamic/tls.yml`; the file provider hot-reloads it. Verify the
certificate and `/api/health` externally. Do not restart shared Traefik unless
file rollback fails and sibling-site impact has been assessed.
