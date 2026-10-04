# Animal Farts (PootBox)

An ad-free, offline-first soundboard PWA for young kids (roughly ages 5 to 7): tap a big card, hear a silly sound, or record your own.

## What it does

PootBox is built for a parent handing a shared phone or tablet to a young child. Kids tap animal, fart, silly and instrument sounds, record their own sounds with the microphone, and keep playing offline. Families can share a recording through a short, expiring code instead of public profiles or feeds.

Child safety is a design constraint, not an afterthought. The v1 boundary keeps public profiles, discovery, follows, feeds, comments, reactions and public recording listings switched off by default. See [docs/v1-child-safety-boundary.md](docs/v1-child-safety-boundary.md).

## Key features

- Card grid of built-in sounds (30 shown by default, with a Show all toggle for the full library), grouped into animal, fart, silly and instrument categories
- Microphone recording with rename and delete, stored locally in IndexedDB and uploaded to the server when online
- Durable upload/delete queue with idempotent retries, so recordings survive flaky connections
- Controlled sharing with eight-character codes that expire after 30 days
- Offline play through a service worker that precaches the app shell, fonts and audio
- Web Audio synth fallback if a sample fails to load, plus a first-tap audio unlock for iOS Safari
- Single-voice audio policy (a new sound stops the previous one), first-run intro, reduced-motion setting
- Server-side banned-word filter and per-device upload limits
- Android build through Capacitor (`com.ashbi.pootparty`)
- No accounts, ads, third-party analytics or AI providers

## Tech stack

- Frontend: React 19, TypeScript (strict), Vite 8, PWA service worker
- Backend: Node.js, Express 4, better-sqlite3, multer, express-rate-limit
- Mobile: Capacitor 8 (Android)
- Testing: Node test runner (unit and server integration), Playwright (mobile Chromium journeys), ESLint
- Delivery: Docker image published to GHCR with provenance and SBOM, GitHub Actions CI, Dependabot

## Running locally

The frontend and the server are two npm projects, each with its own lockfile.

```bash
npm ci
npm ci --prefix server
PORT=3000 DATA_DIR="$PWD/.data" bash scripts/serve-local.sh
```

Open http://localhost:3000. The single-origin server is needed for recording, sharing and every other `/api` flow. `npm run dev` (Vite on port 5173) is fine for frontend-only work but has no API proxy.

Build and preview the production bundle:

```bash
npm run build
npm run preview
```

## Testing

Use Node 20 for the release checks:

```bash
npm test                         # production build + unit and server integration tests
npm run lint
npx playwright install chromium  # first E2E run only
npm run test:e2e
```

The Playwright suite starts the production server with a temporary database and upload directory, so it never touches normal local data. `npm test` also enforces production bundle ceilings: 380 KiB raw / 115 KiB gzip for all JavaScript, 70 KiB gzip for the initial entry, and 5 KiB gzip for CSS.

## Android

```bash
npm run cap:build   # build the web bundle and sync it into android/
npm run cap:open    # open the project in Android Studio
```

Release signing and toolchain details are in [BUILD.md](BUILD.md) and [docs/capacitor.md](docs/capacitor.md).

## Project structure

```
src/pootbox/            main UI, components, hooks, audio manager, sync queue, sharing
src/audio/              sound pool and iOS audio unlock
server/                 Express + SQLite API and moderation filter
public/sounds/          the sound library (mp3)
scripts/                local server, sound scanner, service worker asset injection
tests/                  unit, server integration and Playwright tests
android/                Capacitor Android project
docs/                   API, architecture, safety boundary and operations docs
```

## Deployment

Merges to `main` publish a provenance-attested container image to GHCR. Production promotes that exact image by digest and never rebuilds source. Details are in [docs/production-operations.md](docs/production-operations.md).

## More docs

- [docs/api.md](docs/api.md): HTTP API contract
- [docs/pootbox-architecture.md](docs/pootbox-architecture.md): UI ownership map
- [docs/v1-child-safety-boundary.md](docs/v1-child-safety-boundary.md): privacy and safety decisions
- [docs/product-control.md](docs/product-control.md): product position and roadmap
- [docs/history.md](docs/history.md): index of historical plans

The social features (Friends, profiles, feed) exist in the code but are disabled. They can only be turned on for controlled testing by building with `VITE_SOCIAL_FEATURES_ENABLED=true` and running the server with `SOCIAL_FEATURES_ENABLED=1`.
