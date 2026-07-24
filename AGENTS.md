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

### Tests (two pre-existing timing caveats in this environment)
- `npm test` = `tsc -p tsconfig.test.json` then `node --test ... --test-timeout=8000`.
- `tests/unit-audio.test.mjs` takes ~10s here but the repo pins `--test-timeout=8000`, so it can report a spurious file-level timeout / `cancelled`. Confirm it in isolation with a larger timeout: `node --test --test-timeout=60000 tests/unit-audio.test.mjs` (all 11 pass).
- `tests/server-integration.test.mjs` spawns the server on a fixed port (5284) with a 5s health-check window. Under parallel file execution (or if a stray `server.js` from an earlier run is holding the port) it fails intermittently with `ECONNREFUSED 127.0.0.1:5284`. Before re-running, kill leftovers (`ps aux | grep [s]erver.js`) and/or run serially: `node --test --test-concurrency=1 --test-timeout=15000 tests/server-integration.test.mjs`. The server itself starts reliably standalone.

### Lint / build
- `npm run lint` reports ~10 warnings and 0 errors — that is the expected clean state.
- `npm run build` = `tsc -b && vite build && node scripts/inject-sw-assets.mjs`.
