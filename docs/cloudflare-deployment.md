# Cloudflare deployment

Cloudflare Pages serves the existing Vite build and an advanced-mode Worker.
The Worker keeps the production v1 API contract and always disables public
social/discovery routes. The Express/VPS deployment remains available.

## Resources and build

- Account: Camster91@gmail.com's Account (`1b2e351cbb39ab6b80efe36ca3577fe5`).
- Source branch: `codex/cloudflare-deployment`; no change to `main` or VPS release automation.
- Output: `dist`; Node 24 for the Cloudflare build and Worker tests.
- Build: `npm run lint && node --test tests/cloudflare.test.mjs && npm run build && node scripts/build-cloudflare.mjs`.
- `DB`: isolated D1 database `pootbox-cloudflare`.
- `AUDIO`: private R2 bucket `pootbox-audio-cloudflare`; do not enable public bucket access.
- Apply `cloudflare/schema.sql` to that new D1 database before deployment.
- Keep automatic production and preview deployment disabled; deploy reviewed commits explicitly.
- Do not enable third-party analytics or social feature flags.

`scripts/build-cloudflare.mjs` embeds the existing moderation module in the Worker.
No additional application dependencies are required. The unchanged Vite build still
produces the Android/Express frontend without a Cloudflare Worker.

## Behaviour and verification

The Worker implements health, recording upload, owner deletion, controlled share
codes, audio playback (including HEAD/range requests), and sanitised support/error
logging. It retains the 5 MiB audio cap, 40-recording quota, magic-byte validation,
device ownership, upload/delete operation IDs, and narrow Capacitor CORS.
Rate limits use atomic D1 counters keyed by a per-minute IP hash, not raw IPs.
Share expiry is checked on every lookup, even before background cleanup runs.
Expired shares, 90-day delete tombstones, and old rate counters are reclaimed
opportunistically and on health probes. Audio responses require a live metadata
row; the bucket itself is private.

Run `node --test tests/cloudflare.test.mjs` on Node 24. The suite executes real
SQLite SQL through an adapter and covers complete upload/share/delete/retry,
ownership, disabled social routes, invalid audio, body limits, expiry, concurrent
quota/retry enforcement, storage failures, rate limits, headers and CORS.
These tests do not replace smoke checks against Cloudflare's D1/R2 runtime.

Before assigning a custom domain, check app loading and built-in sound playback;
record/upload, share/resolve, delete/retry and offline reload; microphone access;
phone/tablet/desktop layouts; health; manifest and service worker; security headers;
and social-route 404 responses. Avoid uploading real children's audio during QA.

## Existing data and cutover

The new Cloudflare database starts empty. No existing recordings, share codes or
VPS files are deleted or overwritten by this deployment. Existing browser-local
recordings belong to their original origin and do not automatically transfer to
a new `pages.dev` origin.

Before moving `animals.ashbi.ca`, obtain a verified SQLite backup and matching
uploads archive from the VPS. Import only v1 recordings, share codes and deletion
tombstones; retain IDs, filenames, ownership credentials, operation IDs and
timestamps. Stage audio privately in R2, validate checksums/counts, then import the
matching rows. Rehearse lookups and deletions using operator-owned test recordings.
Freeze VPS writes during final reconciliation so no upload or deletion is lost.
Never expose ownership credentials in logs, public artefacts or source control.

Only after reconciliation should the custom domain move to Cloudflare. Retain the
VPS database, uploads, prior image and DNS/route values for rollback. Redeploy a
previous Pages version for code-only rollback; do not erase D1/R2 data. After writes
begin on Cloudflare, reconcile those writes before routing back to the VPS.

The existing `docs/production-operations.md` continues to describe the VPS only.
