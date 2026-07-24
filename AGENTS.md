# AGENTS.md

## Cursor Cloud specific instructions

Animal Farts / "PootBox" is a kids' PWA soundboard. It is one product delivered as a React 19 + Vite frontend plus a small Express + SQLite backend. See `README.md` (run/build/stack) and `BUILD.md` (Android/Capacitor) for standard commands.

### Layout / services
- Two independent npm projects, each with its own lockfile: the repo root (frontend + Vite + Capacitor tooling) and `server/` (Express + `better-sqlite3` + `multer`). The startup update script installs both.
- The only backend service is `server/server.js`. SQLite (`better-sqlite3`) is embedded and the uploads dir is on the local filesystem — there is no external database, cache, or third-party dependency. Both are auto-created on startup from `DB_PATH` / `UPLOAD_DIR`.

### Running
- Frontend-only dev: `npm run dev` (Vite on :5173). Gotcha: there is no Vite dev proxy, and the client calls the API via relative `/api/...` paths, so API-backed features (recording upload, share codes, social feed) do NOT work in this mode.
- Full end-to-end (single origin, SPA + `/api` on one port): `PORT=3000 DATA_DIR=/workspace/.data bash scripts/serve-local.sh`. It builds `dist/` if missing and serves the built SPA and the API from one Express process, so relative `/api` paths resolve. Health check: `GET /api/health`. Run `npm run build` first if you changed frontend code (serve-local only auto-builds when `dist/` is absent).
- Running `server/server.js` directly defaults to `PORT=5174`; `serve-local.sh` defaults to `3000`.

### Tests
- `npm test` = `tsc -p tsconfig.test.json` then `node --test ... --test-timeout=8000`. The full suite (201 tests) passes reliably.
- `tests/server-integration.test.mjs` spawns the server on a fixed port (5284) with a 5s health-check window and sets `RATE_LIMIT_DISABLED=1` so its many uploads don't exhaust the 6/min upload limiter. If a stray `server.js` from an earlier run is holding 5284, kill leftovers (`ps aux | grep [s]erver.js`) before re-running.
- `tests/unit-audio.test.mjs` is timing-sensitive (~10s, near the 8s file timeout). On a heavily loaded machine, run it (or the suite) serially with more headroom: `node --test --test-concurrency=1 --test-timeout=30000 tests/unit-*.test.mjs tests/server-integration.test.mjs`.
- `server/moderation.js` is the single source of truth for the banned-word filter and is imported by both `server.js` and `tests/unit-v73-moderation-validation.test.mjs` (keep them in sync via the module, not copies).

### Lint / build
- `npm run lint` reports 6 warnings and 0 errors (all `react-hooks/exhaustive-deps` in `PootBox.tsx` / `useRecording.ts`) — that is the expected clean state.
- `npm run build` = `tsc -b && vite build && node scripts/inject-sw-assets.mjs`.
