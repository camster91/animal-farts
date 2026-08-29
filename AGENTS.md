# AGENTS.md

## Cursor Cloud specific instructions

Animal Farts / "PootBox" is a kids' PWA soundboard. It is one product delivered as a React 19 + Vite frontend plus a small Express + SQLite backend. See `README.md` (run/build/stack), `docs/api.md` (current HTTP contract), `BUILD.md` (Android/Capacitor), and the open GitHub roadmap issue #28 before making changes. Historical plans are indexed in `docs/history.md` and are not current requirements.

### Layout / services
- Two independent npm projects, each with its own lockfile: the repo root (frontend + Vite + Capacitor tooling) and `server/` (Express + `better-sqlite3` + `multer`). Install both before running integration tests.
- The only backend service is `server/server.js`. SQLite (`better-sqlite3`) is embedded and the uploads dir is on the local filesystem — there is no external database, cache, or third-party dependency. Both are auto-created on startup from `DB_PATH` / `UPLOAD_DIR`.
- Play and the dormant Friends/profile views are code-split with `React.lazy` and `Suspense`. The v1 production default exposes Play only; do not enable the social feature flags or reintroduce eager imports without the safeguards documented in `docs/v1-child-safety-boundary.md`.

### Running
- Frontend-only dev: `npm run dev` (Vite on :5173). Gotcha: there is no Vite dev proxy, and the client calls the API via relative `/api/...` paths, so API-backed features (recording upload, share codes, social feed) do NOT work in this mode.
- Full end-to-end (single origin, SPA + `/api` on one port): `PORT=3000 DATA_DIR=/workspace/.data bash scripts/serve-local.sh`. It builds `dist/` if missing and serves the built SPA and the API from one Express process, so relative `/api` paths resolve. Health check: `GET /api/health`. Run `npm run build` first if you changed frontend code (serve-local only auto-builds when `dist/` is absent).
- Running `server/server.js` directly defaults to `PORT=5174`; `serve-local.sh` defaults to `3000`.
- Production operations are defined in `docs/production-operations.md`; Traefik owns public ports 80/443 and ACME renewal. Release images are built from locked dependencies on `main` and promoted by immutable digest; the VPS must not rebuild source. Do not reintroduce Caddy topology or overwrite shared fleet config from repository snapshots.

### Tests
- TypeScript strict mode is enabled for app, Node config, and test compilation. Do not disable `strict` to work around a new error; fix or narrow the type instead.
- `npm test` builds the production frontend, compiles the test targets, and runs unit + server integration tests. The production build is required because the server integration suite verifies the built SPA and static pages. The suite has historically contained 201 tests; treat the current test runner output as authoritative if that count changes.
- `npm run test:e2e` builds the app and runs the mobile Chromium release journeys against an isolated temporary SQLite database and upload directory. Install its pinned browser once with `npx playwright install chromium`.
- `tests/server-integration.test.mjs` spawns the server on fixed port 5284 and sets `RATE_LIMIT_DISABLED=1` so its many uploads don't exhaust the 6/min upload limiter. If a stray `server.js` from an earlier run is holding 5284, kill leftovers (`ps aux | grep [s]erver.js`) before re-running.
- `tests/unit-audio.test.mjs` is timing-sensitive. For CI or a loaded machine build first, then use the release-gate command: `npm run build && node --test --test-concurrency=1 --test-timeout=30000 tests/unit-*.test.mjs tests/server-integration.test.mjs tests/server-social-disabled.test.mjs`.
- `server/moderation.js` is the single source of truth for the banned-word filter and is imported by both `server.js` and `tests/unit-v73-moderation-validation.test.mjs` (keep them in sync via the module, not copies).

### Lint / build / CI
- `npm run lint` must not produce errors. Existing warnings should be reduced when touching the affected code rather than normalized as a permanent baseline.
- `npm run build` = `tsc -b && vite build && node scripts/inject-sw-assets.mjs`.
- `.github/workflows/ci.yml` is the merge gate: install root + server dependencies and Chromium, lint, compile test targets, run the serial and Playwright suites, build the production frontend, and syntax-check `server/server.js`.
- Do not merge a change that affects Play, recording, sharing, offline behavior, Friends, profiles, or build/runtime configuration unless the exact PR head commit has passed CI.

### Product safety
- This app is aimed at young children. Treat public profiles, discovery, follows, comments, reactions, recording uploads, and sharing as child-safety/privacy surfaces, not ordinary social features.
- Prefer controlled family/friend sharing over broader discovery when it meets the same product goal. Do not expand public social functionality without an explicit product decision covering discoverability, public data, moderation/reporting, parent controls, and data retention/deletion.
- The current product decision is `docs/v1-child-safety-boundary.md`: social/discovery routes and UI are disabled by default. Controlled tests must set both frontend and server flags explicitly.
