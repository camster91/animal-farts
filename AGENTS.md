# AGENTS.md

These instructions are shared repository guidance for Codex, ChatGPT Work, Claude, Cursor, and other capable coding agents. Cloud-specific setup notes are included where useful, but the product/safety/release rules apply in every environment.

## Product authority and reading order

Animal Farts / **PootBox** is an ad-free, offline-first soundboard for families with children roughly ages 5–7. The child is the primary user; an adult is the safety decision-maker/operator for sharing, external links, store actions, and future monetization.

Use repository sources in this order:

1. `AGENTS.md` — durable coding-agent execution and safety rules.
2. `docs/product-control.md` — durable product-level source of truth for position, decisions, current evidence, risks, metrics, and roadmap.
3. `README.md` — representative run/build/test/deploy overview and documentation index.
4. `docs/v1-child-safety-boundary.md` — current child-safety/privacy feature boundary.
5. `docs/api.md`, `docs/pootbox-architecture.md`, `BUILD.md`, and `docs/production-operations.md` for the affected technical/release area.
6. GitHub issue #28 and linked child issues — active implementation backlog.
7. Current pull requests and exact-head CI/deployment evidence — live work and verification state.

Historical plans are indexed in `docs/history.md` and are not current requirements. Do not revive deprecated physics/social/product concepts simply because old code or documents still describe them.

Current product authority deliberately defers public social discovery, profiles, follows, feeds, comments, reactions, anonymous communication, ads, behavioural analytics, and AI features. Do not expand those surfaces without an explicit current product decision and the required child-safety/privacy/legal review.

## Layout / services

- PootBox is one product delivered as a React 19 + Vite frontend plus a small Express + SQLite backend. See `README.md` (run/build/stack), `docs/api.md` (current HTTP contract), `BUILD.md` (Android/Capacitor), and the open GitHub roadmap issue #28 before making changes.
- Two independent npm projects, each with its own lockfile: the repo root (frontend + Vite + Capacitor tooling) and `server/` (Express + `better-sqlite3` + `multer`). Install both before running integration tests.
- The only backend service is `server/server.js`. SQLite (`better-sqlite3`) is embedded and the uploads dir is on the local filesystem — there is no external database, cache, or third-party dependency. Both are auto-created on startup from `DB_PATH` / `UPLOAD_DIR`.
- Play and the dormant Friends/profile views are code-split with `React.lazy` and `Suspense`. The v1 production default exposes Play only; do not enable the social feature flags or reintroduce eager imports without the safeguards documented in `docs/v1-child-safety-boundary.md`.
- `docs/pootbox-architecture.md` maps orchestration ownership. Keep durable recording/upload work in `useRecording` + `syncQueue`, and controlled sharing in `shareOrchestration`; PootBox should compose those interfaces rather than absorb their effects again.

## Running

- Frontend-only dev: `npm run dev` (Vite on :5173). Gotcha: there is no Vite dev proxy, and the client calls the API via relative `/api/...` paths, so API-backed features (recording upload, share codes, social feed) do NOT work in this mode.
- Full end-to-end (single origin, SPA + `/api` on one port): `PORT=3000 DATA_DIR=/workspace/.data bash scripts/serve-local.sh`. It builds `dist/` if missing and serves the built SPA and the API from one Express process, so relative `/api` paths resolve. Health check: `GET /api/health`. Run `npm run build` first if you changed frontend code (`serve-local.sh` only auto-builds when `dist/` is absent).
- Running `server/server.js` directly defaults to `PORT=5174`; `serve-local.sh` defaults to `3000`.
- Production operations are defined in `docs/production-operations.md`; Traefik owns public ports 80/443 and ACME renewal. Release images are built from locked dependencies on `main` and promoted by immutable digest; the VPS must not rebuild source. Do not reintroduce Caddy topology or overwrite shared fleet config from repository snapshots.

## Verification

There is deliberately no fake single `verify` command on current `main`. Use the repository's real layered gates and report exactly which level actually ran.

### Fast/focused checks

Use the smallest relevant test/lint/build command while iterating. TypeScript strict mode is enabled for app, Node config, and test compilation. Do not disable `strict` to work around a new error; fix or narrow the type instead.

### Merge-level source gate

- `npm run lint` must not produce errors. Existing warnings should be reduced when touching the affected code rather than normalized as a permanent baseline.
- `npm test` builds the production frontend, compiles the test targets, and runs unit + server integration tests. The production build is required because the server integration suite verifies the built SPA and static pages. The suite has historically contained 201 tests; treat the current test runner output as authoritative if that count changes.
- `npm run build` = `tsc -b && vite build && node scripts/inject-sw-assets.mjs`.

### Browser/release gate

- `npm run test:e2e` builds the app and runs the mobile Chromium release journeys against an isolated temporary SQLite database and upload directory. Install its pinned browser once with `npx playwright install chromium`.
- `tests/server-integration.test.mjs` spawns the server on fixed port 5284 and sets `RATE_LIMIT_DISABLED=1` so its many uploads don't exhaust the 6/min upload limiter. If a stray `server.js` from an earlier run is holding 5284, kill leftovers (`ps aux | grep [s]erver.js`) before re-running.
- `tests/unit-audio.test.mjs` is timing-sensitive. For CI or a loaded machine build first, then use the release-gate command: `npm run build && node --test --test-concurrency=1 --test-timeout=30000 tests/unit-*.test.mjs tests/server-integration.test.mjs tests/server-social-disabled.test.mjs`.
- `server/moderation.js` is the single source of truth for the banned-word filter and is imported by both `server.js` and `tests/unit-v73-moderation-validation.test.mjs` (keep them in sync via the module, not copies).
- `.github/workflows/ci.yml` is the merge gate: install root + server dependencies and Chromium, lint, compile test targets, run the serial and Playwright suites, build the production frontend, and syntax-check `server/server.js`.
- Do not merge a change that affects Play, recording, sharing, offline behavior, Friends, profiles, child-safety gates, or build/runtime configuration unless the exact PR head commit has passed the applicable CI/release gates.

A queued, unavailable, cancelled, superseded, or infrastructure-failed check is not a pass and is not automatically evidence of an application failure. Never weaken tests, child-safety controls, required CI, bundle ceilings, backup/restore checks, or production smoke gates merely to obtain green status.

## Web / PWA QA

For rendered UI changes, verify representative sizes when browser access is available:

- Mobile: approximately 390 px.
- Tablet: approximately 768 px.
- Desktop: approximately 1440 px.

Check the affected journey plus card/control geometry, touch targets, navigation/dialogs, keyboard operation, focus visibility/restoration, onboarding/update behaviour, microphone permission/error states, recording/save/delete, controlled sharing, offline/recovery, PWA/service-worker update behaviour, responsive imagery/audio controls, console errors, loading/error/empty states, and accessibility basics where relevant.

Do not infer physical-device microphone/audio, iOS audio-unlock, Android/Capacitor, store-policy, parent usability, or real-family pilot success from source or desktop browser inspection alone. Those require separate evidence.

## Product safety / privacy

- This app is aimed at young children. Treat public profiles, discovery, follows, comments, reactions, recording uploads, sharing, external links, analytics, monetization, and store submission as child-safety/privacy surfaces, not ordinary feature work.
- Prefer controlled family/friend sharing over broader discovery when it meets the same product goal.
- The current product decision is `docs/v1-child-safety-boundary.md`: social/discovery routes and UI are disabled by default. Controlled tests must set both frontend and server flags explicitly.
- Do not expand public social functionality without an explicit product decision covering discoverability, public data, moderation/reporting, parent controls, retention/deletion, legal/store policy, and abuse handling.
- Do not add ads, behavioural tracking, AI features, or child-facing purchase prompts without an explicit current product decision and appropriate privacy/legal/store review.
- Use synthetic recordings/accounts/data for tests and evidence. Do not place real family/child data or recordings in GitHub issues, PRs, logs, fixtures, or public artifacts.
- Treat microphone recordings, device identifiers, share codes, upload paths, IP-derived abuse/rate-limit data, and deletion/retention behaviour as sensitive.

If a suspected real credential, private recording, or child/family data is found in repository material, stop handling the value/content and report only the repository/path plus remediation need.

## Production and deployment boundary

`docs/product-control.md` records the latest verified production truth; `docs/production-operations.md` defines the operational procedure. A repository script or technically available deployment path is not authorization to execute it.

Agents may inspect, implement, test, document, branch, commit, create issues, and open draft PRs when authorised. Without Cameron explicitly approving the exact difficult-to-reverse action, agents must not:

- merge a pull request;
- deploy/promote a production image or modify the VPS;
- publish/tag a release or submit an app/store build;
- change Traefik/shared fleet configuration, DNS, TLS, firewall/network exposure, credentials, secrets, permissions, access, billing, monitoring spend, or backup destinations;
- enable dormant social features in production;
- delete/restore/migrate real recording or user data;
- contact/recruit pilot families or send external communications;
- make legal/store-compliance or product-market-fit claims.

Production promotions must use the documented immutable image/artifact path and applicable preflight, backup/restore, smoke, monitoring, and rollback evidence. Do not rebuild source directly on the VPS or replace shared fleet configuration from repository snapshots.

If the previous known-good artifact, backup, restore evidence, monitoring destination, or rollback path cannot be verified, report deployment/rollback readiness as unknown or blocked rather than inventing it.

## Definition of done and handoff

Use Cameron's status model:

1. Completed and verified
2. Completed but awaiting verification
3. In progress
4. Blocked
5. Awaiting client or teammate
6. Next action

Never report **Completed and verified** without the required exact-head/source/browser/device/production evidence for the scope.

Every substantial coding handoff should include:

- branch;
- exact commit(s);
- pull request;
- files changed;
- implementation summary;
- checks actually executed and pass/fail/queued state;
- exact-head CI/release evidence inspected;
- screenshots/URLs only when actually captured or verified;
- child-safety/privacy/data impact;
- deployment/rollback impact;
- remaining risks/blockers;
- production/release status;
- next action and any approval gate.
