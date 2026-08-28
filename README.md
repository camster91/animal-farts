# 💥 Animal Farts

A PWA for kids (5-7) — tap a sound tile, hear the sound. It includes built-in sounds, custom microphone recording, controlled sharing via expiring eight-character codes, combo/confetti feedback, and offline play.

The v1 safety boundary keeps public profiles, discovery, follows, feeds, comments, reactions, and public recording listings disabled by default. See `docs/v1-child-safety-boundary.md`.

## Run locally

```bash
npm ci
npm ci --prefix server
PORT=3000 DATA_DIR="$PWD/.data" bash scripts/serve-local.sh
```

Open http://localhost:3000. The single-origin server is required for recording,
sharing, and every other `/api` flow. `npm run dev` on port 5173 is useful for
frontend-only work, but it has no API proxy.

## Build

```bash
npm run build
npm run preview
```

## Test

Use Node 20 for the release checks:

```bash
npm test
npm run lint
npx playwright install chromium # first E2E run only
npm run test:e2e
```

The Playwright suite starts the production server with a temporary database
and upload directory. It never reads or modifies normal local or deployed
recording data.

The normal test command also enforces production bundle ceilings after its
clean build: 380 KiB raw / 115 KiB gzip for all JavaScript, 70 KiB gzip for the
initial entry, and 5 KiB gzip for CSS. Raise a ceiling only with measured
device/network evidence and a recorded product tradeoff.

## Deploy

Merges to `main` publish a provenance-attested, SBOM-enabled GHCR image tagged
with the commit. `scripts/deploy-vps.sh <main-commit>` promotes that exact image
digest; the VPS never rebuilds source. Deployment verifies a fresh backup and
restore rehearsal, records the prior image and backup, runs strict smoke checks,
and automatically rolls back a failed promotion.

Production topology, monitoring, backup, restore rehearsal, rollback, and the
release checklist are in `docs/production-operations.md`. Traefik is the public
TLS edge and owns ACME renewal as documented in `infra/traefik/README.md`.

## Stack

- React 19 + TypeScript
- Vite 8
- HTMLAudioElement (real samples) — synth fallback if a sample fails to load
- PWA with service worker
- Express + better-sqlite3 + multer (server, containerized)
- All UI is inline-styled (no Tailwind despite the package being installed)

## Audio

- **Primary:** 30 built-in sounds spanning animal (12), fart (6, with wet/dry/bubbly/squeaky/long/echo sub-buckets), silly (6), and instrument (6) categories. Sources include [MyInstants](https://www.myinstants.com) (CC-licensed user uploads) and a v70 scan that auto-discovers any new `.mp3` dropped into `public/sounds/`.
- **Fallback:** Web Audio API synth per animal — kicks in automatically if a sample fails to load
- **Custom:** the mic-capture flow stores the recording locally in IndexedDB and attempts an online upload to `/api/recordings`; the local copy remains the offline fallback
- iOS Safari audio unlock on first tap (muted-play warmup)

## Files

- `src/pootbox/PootBox.tsx` — main UI orchestrator (988 lines, 15 components + 7 hooks)
- `src/pootbox/components/CardGrid.tsx` — the v61 kid-facing card grid (replaced the v52 physics canvas)
- `src/pootbox/components/SoundLibrary.tsx` — sound picker (376 sounds via v70 auto-discover, default 30 visible with Show-all toggle)
- `src/pootbox/audioManager.ts` — single-voice audio policy (any new play stops the previous)
- `src/audio/soundPool.ts` — auto-generated sound path pool
- `src/audio/primeAudio.ts` — first-tap iOS Safari audio unlock
- `src/pootbox/syncQueue.ts` — IndexedDB-backed upload/delete queue with idempotent retries
- `src/pootbox/lib/deviceId.ts` — per-device UUID stored in localStorage (used for v74 server-side identification)
- `server/server.js` — Express + SQLite API; see `docs/api.md`
- `scripts/scan-sounds.py` — auto-discovery scan that regenerates `src/pootbox/constants.ts`'s `BUILT_IN_SOUNDS` array
- `public/sw.js` — service worker for offline-first precache (shell + Fredoka fonts)
- `public/sounds/*.mp3` — the sound library

## Child-safety feature gate

The codebase contains Play, Friends, and Me surfaces, but normal builds and
production containers expose Play plus controlled share codes only. Friends,
Me, discovery, feed, and social API routes are dormant behind two independent
flags. For controlled regression testing, build with
`VITE_SOCIAL_FEATURES_ENABLED=true` and run the server with
`SOCIAL_FEATURES_ENABLED=1`. Do not enable these flags in production without
completing the safeguards in `docs/v1-child-safety-boundary.md`.

Current API, privacy, historical documents, and production authority are
indexed in `docs/api.md`, `docs/v1-child-safety-boundary.md`,
`docs/history.md`, and `docs/production-operations.md`.

## Features

- v25k–v70: physics canvas with bubbles that react to touches (deprecated; see FEATURE-REVIEW-2026-06-18.md)
- v61: CardGrid — simple card-based grid, no physics
- v67: FirstRunIntro — first-launch onboarding modal
- v69: RecordSheet + RenameModal — record custom sounds, rename cards
- v70: scan-sounds auto-discovery (376 .mp3 files generate 30 curated `BUILT_IN_SOUNDS`)
- v71: SoundLibrary caps the default visible tile count at 30 with a Show-all toggle
- v75: scanner-drift regression test (constants.ts must match what scan-sounds.py produces)
- v76: ShareSheet wired to the server (`/api/share` mints, `/api/share/:code` looks up); CardGrid delete calls `DELETE /api/recordings/:id` (no more orphan uploads)

## License

MIT.
