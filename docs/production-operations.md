# Production operations and recovery

Verified against the VPS on 2026-08-29. Owner: Cameron Ashley. Public service:
`https://animals.ashbi.ca`; health URL: `/api/health`.

## Runtime inventory

| Item | Production value |
| --- | --- |
| Edge | Traefik 3.7, host-network ports 80/443 |
| App | `animal-farts`, loopback `127.0.0.1:3015` to container `3000` |
| Data | `/data/animal-farts` to `/app/data` |
| SQLite | `/data/animal-farts/farts.db` (WAL mode) |
| Uploads | `/data/animal-farts/uploads` |
| Current observed image | `camster91/animal-farts:ssh-7f8b0698fa93` (`sha256:b582885ad54e7eae5809f2a176a793b4be1805c4e90c7a8bfe9ea7441c84b001`) |
| Current source commit | `7f8b0698fa9306437c79779db66f529a3bdcaaa6` |
| Deployment record | `/data/animal-farts/releases/20260829T075018Z-7f8b0698fa93.env` |
| Rollback image | `sha256:2d17e2d2bf5516a3c6ff5a7c0e6c7ae46a073edd596cd079bb546cf697665a2a` |
| Restart policy | `unless-stopped` with Docker health check |
| TLS | Traefik `letsencrypt` ACME resolver |

## Monitoring and escalation

`animal-farts-ops-check.timer` runs every five minutes. It emits no request
bodies, audio, device IDs, profile data, or recording names. It checks strict
external health, container state, restart count availability, disk/inode use
(80% threshold), certificate lifetime (30/14/7-day policy), and backup age. A
container with more than two lifetime restarts is treated as a possible restart
loop; set `ANIMAL_FARTS_MAX_RESTARTS` in the root-only environment file only
after investigating and recording an intentional restart.

Failures appear in `journalctl -u animal-farts-ops-check.service`. Independent
external monitoring is provided by Uptime Kuma monitor 29 against
`/api/health`, connected to the active Mailgun notification destination. A
controlled DOWN/UP test delivered both state changes successfully. Monitor and
notification credentials remain secrets and must never enter Git or command
output.

## Backup and retention

`animal-farts-backup.timer` runs daily near 03:00 UTC. It uses SQLite's online
backup API to include committed WAL data, copies uploads into the same bundle,
runs `PRAGMA integrity_check`, and writes a SHA-256 manifest. Root-only archives
live under `/data/animal-farts/backups/daily` for 30 days. A successful new
archive must exist before retention deletion runs.

Docker cleanup is intentionally not automatic. Retain the current and previous
immutable app images; remove only untagged images/build cache after checking
sibling dependencies. Never prune volumes.

## Restore rehearsal

```bash
latest=$(find /data/animal-farts/backups/daily -type f \
  -name 'animal-farts-*.tar.gz' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
sudo animal-farts-restore-rehearsal "$latest"
```

The rehearsal verifies manifests and SQLite integrity, compares recording
count, starts the current image on an isolated random loopback port, checks
health, and downloads one restored audio file when recordings exist. It never
stops or modifies the live container. The 2026-08-29 pre-release rehearsal
passed with 8 recordings and successful audio playback. The retained fresh
backup is
`/data/animal-farts/backups/daily/animal-farts-20260829T074708Z.tar.gz`.

## Rollback

Before promotion record the current image and create a fresh backup. If a new
image fails, recreate only `animal-farts` with the recorded prior immutable
image and the same port, environment, health check, and data mount. Do not
restore data for an application-only rollback. Restore backups to a new
directory and rehearse before replacing authoritative data.

## Release go/no-go checklist

- [ ] Exact merge SHA passed required lint, build, serial, E2E, and syntax checks.
- [ ] Immutable image tag/digest and previous rollback image are recorded.
- [ ] Fresh backup and checksum, integrity, count, and audio rehearsal passed.
- [ ] Disk/inodes are below 80%; app and Traefik have no restart loop.
- [ ] Trusted certificate has 30+ days left or successful renewal is proven.
- [ ] Homepage, health, manifest, service worker, recording, controlled share, deletion, and offline shell smoke checks pass.
- [ ] Child-safety flags remain off in production.
- [ ] External alert notification was test-fired and acknowledged.
- [ ] Rollback owner, image, backup path, and incident notes are recorded.

Any unchecked blocker is a no-go unless it has an explicit owner, expiry, and
documented acceptance decision.
