# Animal Farts — Feature Review (2026-06-18)

App surface at `main` @ `f01208b` (v75). Live at `https://animals.ashbi.ca/`,
container `camster91/animal-farts:f01208b`. Reviewed against the live SPA + the
working tree.

## Surface map

**Client** (4,425 lines, 15 components + 7 hooks + 1 orchestrator):
- PootBox.tsx (988) — orchestrator
- components/ — CardGrid (351), SoundLibrary (484), ShareSheet (377), RecordSheet (237), RenameModal (203), CanvasEffects (173), EmojiBubble (143), InstallPrompt (114), OnboardingHint (85), UpdatePrompt (76), VolumeSlider (80), FirstRunIntro (86), FooterBar (29), EmptyPageHint (45)
- hooks/ — usePhysicsLoop (235), useRecording (274), useCanvasState (141), usePagesState (151), useCanvasHandlers (67), useSettings (28), useToast (17)
- physics.ts (184), recordings.ts (372), audioManager.ts (single source of audio truth), soundPool.ts (792, generated)

**Server** (1,001 lines, 22 endpoints):
- /api/health, /api/errors (client error reporting), /api/feedback (parent feedback, no client)
- /api/recordings, /api/recordings/:id, /api/recordings/:id/upvote
- /api/share, /api/share/:code (4-char codes)
- /api/me, /api/users/:handle, /api/users/:handle/follow, /api/users/:handle/followers, /api/users/:handle/following, /api/users/:handle/recordings, /api/users (list)
- /api/feed
- /api/recordings/:id/comments, /api/comments/:id
- /api/recordings/:id/reactions

## Top finding: client/server API usage is severely asymmetric

**The SPA only calls 2 of the 22 server endpoints.** Specifically:
- `POST /api/recordings` (upload) — wired in `src/pootbox/lib/uploadRecording.ts`
- `POST /api/errors` (client error reporting) — wired in `src/lib/errorReporter.ts`

**20 server endpoints are dead on the client side:**
- `/api/health` — not used by client (server-internal health check only)
- `/api/share`, `/api/share/:code` — ShareCode minting + lookup. The ShareSheet component shows a "share this sound" UI but **doesn't call `/api/share`**. The 4-character share codes that the whole /api/share endpoint exists to support are not generated, displayed, copied, or entered by the SPA.
- `/api/recordings` (GET, list) — The discover/browse view that the public feed would power doesn't exist in the SPA.
- `/api/recordings/:id/upvote` — Kid-upvotes-other-kid's-recording. No UI.
- `/api/recordings/:id/comments` (GET/POST) — Comment thread. No UI.
- `/api/comments/:id` (DELETE) — Comment delete. No UI.
- `/api/recordings/:id/reactions` (GET/POST) — Emoji reactions (👍/😂/💀). No UI.
- `/api/me`, `PATCH /api/me` — User profile / avatar / bio / handle. No UI.
- `/api/users/:handle`, `.../follow`, `.../followers`, `.../following`, `.../recordings` — User profile pages. No UI.
- `/api/users` (list) — Discover users. No UI.
- `/api/feed` — Instagram-style friends feed. No UI.
- `DELETE /api/recordings/:id` — Delete own recording. Inline delete exists on CardGrid (line 535), but it deletes the IDB bubble, not the server record. The custom-recording DELETE endpoint is never hit.
- `/api/feedback` — Parent dashboard feedback form. No UI in this codebase.

This is the "pass 4 — what's missing" gap. The product has two faces:

- **The actual product (kid-facing, ships today):** CardGrid with custom bubbles, built-in sounds from /sounds/, recording via mic, share-code UI (SheetComponent), first-run intro, install prompt, offline-first SW precache. Works end-to-end.
- **The social layer (server-only, dead on client):** users, follows, feed, comments, reactions, share-code generation, profile editing. 14 endpoints that the server happily serves but no client route hits.

The server code is well-built (v72-v73 hardened, N+1 fix in v74) — but it's protecting code that nobody calls.

## Top 10 features, present + missing

1. **CardGrid (kid-facing sound canvas) — PRESENT.** v61. Tap a card to play, tap "add" to open SoundLibrary, tap the pencil to swap sounds. Replaces v52's physics bubble canvas.
2. **SoundLibrary (built-in sound picker) — PRESENT.** v70 + v71. 30 built-in sounds across 4 buckets (Animals/Farts/Silly/Instruments), Farts sub-bucket chips, search, "Record your own" CTA, v71 cap at 30 tiles with Show-all toggle.
3. **Recording flow — PRESENT.** v55-v60. Mic permission flow, MediaRecorder, iOS Safari audio unlock, kid picks emoji + name on save, server-side `POST /api/recordings`. End-to-end working.
4. **Share-code mint + lookup — SERVER ONLY, NO UI.** `/api/share` and `/api/share/:code` exist with crypto-random codes, rate limits, lookup endpoint — but **ShareSheet.tsx has no fetch call to either**. The component renders a UI with "tap to copy" + "paste a friend's code" affordances, but the mint call is missing.
5. **Custom-recording share — BROKEN PARTIAL.** The CardGrid's delete button (PootBox.tsx:535) deletes the IDB bubble but **doesn't call `DELETE /api/recordings/:id`**. So custom recordings persist on the server even after the kid removes them from the canvas.
6. **Public recordings feed (browse) — SERVER ONLY, NO UI.** `GET /api/recordings` returns 4 recordings sorted by upvotes, but the SPA has no browse/discover screen.
7. **Upvote — SERVER ONLY, NO UI.** `POST /api/recordings/:id/upvote` exists, the SPA has no upvote button.
8. **Comments — SERVER ONLY, NO UI.** `GET/POST /api/recordings/:id/comments` and `DELETE /api/comments/:id` exist, the SPA has no comment thread UI.
9. **Reactions — SERVER ONLY, NO UI.** `GET/POST /api/recordings/:id/reactions` with the kid-safe REACTION_EMOJIS set (👍/😂/💀), the SPA has no reactions UI.
10. **User profiles + follows + feed — SERVER ONLY, NO UI.** `GET /api/users/:handle`, `POST .../follow`, `GET /api/feed` — all built, no client route.

## Onboarding: two parallel paths

The codebase has two competing first-run systems:

- **FirstRunIntro** (v69, 86 lines) — Modal that shows on first launch, persists `localStorage["pootbox-firstrun-done"]`.
- **OnboardingHint** (v52-era, 85 lines) — Overlay that shows a hint card near a target bubble, persists `localStorage["pootbox-onboarded-v2"]`.

PootBox.tsx renders FirstRunIntro (line 501) but **does not render OnboardingHint** even though it's imported (line 33). OnboardingHint is dead.

But PootBox checks `pootbox-onboarded-v1` AND `pootbox-onboarded-v2` (line 134) — the v1 check is also dead (v1 was the original onboarding, never shipped to prod).

**Onboarding surface:** FirstRunIntro only. v1 + OnboardingHint code is dead.

## Top 10 components, present + dead

| Component | Lines | Status |
|---|---|---|
| CardGrid | 351 | PRESENT (kid-facing) |
| SoundLibrary | 484 | PRESENT (kid-facing, v70+v71) |
| ShareSheet | 377 | PRESENT (UI only — missing fetch calls) |
| RecordSheet | 237 | PRESENT (recording flow) |
| RenameModal | 203 | PRESENT (rename custom bubbles, v69) |
| CanvasEffects | 173 | PRESENT (ripples/sparks/confetti, drawn by usePhysicsLoop) |
| EmojiBubble | 143 | **DEAD** — never imported anywhere in src/ |
| InstallPrompt | 114 | PRESENT (PWA install banner) |
| FirstRunIntro | 86 | PRESENT (first-run modal) |
| OnboardingHint | 85 | **DEAD** — imported in PootBox:33, never rendered |
| UpdatePrompt | 76 | PRESENT (service worker update banner) |
| VolumeSlider | 80 | PRESENT (volume control modal) |
| EmptyPageHint | 45 | PRESENT (empty-card-grid hint) |
| FooterBar | 29 | PRESENT (bottom safe-area padding) |

**Dead code: 228 lines across 2 components (EmojiBubble + OnboardingHint).**

## Hooks: all live

All 7 hooks are imported by PootBox.tsx and have callers. No dead hooks.

## Top 5 dead features (server endpoints nobody calls)

| Server endpoint | Endpoint count | Effort to wire |
|---|---|---|
| `/api/share` mint + `/api/share/:code` lookup | 2 | Medium (ShareSheet has UI placeholders; need 4-char code generator on client + lookup flow) |
| `/api/feed` (Instagram-style friends feed) | 1 | High (new route, new UI for "people you follow") |
| `/api/users/:handle` + `/api/users` list | 2 | Medium (new "profile" + "discover" routes) |
| Upvote / Comments / Reactions on `/api/recordings/:id/*` | 6 | Medium-High (each is a different UI affordance: thumb, thread, emoji picker) |
| `PATCH /api/me` (profile editor) | 1 | Low (settings modal could host a tab) |

The share-code mint is the highest-value addition: the ShareSheet UI exists, the server endpoints exist, the kid UX is obvious ("tap to share", "paste your friend's code"). The client just needs ~50 lines to wire it.

## Top 5 features that ARE shipped + working (good)

1. **CardGrid with 30-tile cap + Show-all toggle** (v61 + v71) — visible, fast, kid-friendly.
2. **Built-in sound library** (v70) — 376 sounds auto-discovered, 30 in the curated list, 4 buckets + Farts sub-buckets, search, "Record your own" CTA. Good.
3. **Mic recording flow** (v55-v60) — iOS Safari unlock, MediaRecorder, kid emoji + name picker, server upload. End-to-end working with 4 recordings on the demo VPS.
4. **First-run intro + install prompt + update prompt** (v69) — three separate banners that fire at the right moments. Good UX.
5. **Offline-first SW** (v74) — shell assets + 3 Fredoka fonts precached. Scenes removed. Works.

## What the README claims vs. what's real

README says: "A PWA for kids (5-7) — tap an animal, hear a real fart sound. 12 animals, hype meter, random + combo buttons, screen shake, poof particles, fully offline-capable."

Real: 30 built-in sounds (12 animal + 6 fart + 6 silly + 6 instrument), card grid + recording + share-code UI shell, all offline-capable.

"hype meter" — not present in the current code. Searched for `hype`, `meter`, `intensity` — no matches. Was removed at some point or was aspirational in the README.
"random + combo buttons" — combo system IS present (every 5 taps = combo burst, every 10 = confetti) but "random" isn't a button. Random drift was removed with the physics canvas (v61).
"screen shake" — present (the devicemotion handler at PootBox.tsx:243 calls `stopAllSounds()` + opens settings).
"poof particles" — present (sparks on every tap).

The README is mostly accurate but stale. The "12 animals" count is wrong (it's 30 sounds total), "hype meter" is aspirational, "random" doesn't exist anymore.

## Recommendations

**Tier 1 (1-2 days):**
- Wire `/api/share` from ShareSheet. The UI exists, the server exists, just needs the fetch + 4-char code generator + copy-to-clipboard.
- Wire `DELETE /api/recordings/:id` from CardGrid's delete button. Inline delete currently orphans server records.

**Tier 2 (1-2 weeks):**
- Wire `/api/feed` as a new "Friends" tab. Build the data-fetch + render loop. The server endpoint is fast (v74 batched).
- Wire `/api/recordings/:id/upvote` + reactions + comments as a "recording detail" view. Each affordance is independent; ship one at a time.

**Tier 3 (cleanup):**
- Delete `EmojiBubble.tsx` (143 lines, 0 importers) and `OnboardingHint.tsx` (85 lines, 0 importers). Total 228 lines dead code.
- Update README to say "30 built-in sounds (12 animal + 6 fart + 6 silly + 6 instrument)" and drop "hype meter" and "random" (both gone).

**Tier 4 (don't bother):**
- `/api/feedback` — parent feedback endpoint, no client UI. Either delete the endpoint or build the dashboard.
- `/api/users` list + `/api/users/:handle` profile — these are the "social network" features. Wire only if you decide to actually ship the social product, not just the kid-facing sound toy.

## TL;DR

The kid-facing product (CardGrid + SoundLibrary + Recording + FirstRun + SW) is shipped and works. The social product (users + follows + feed + comments + reactions + share codes) has a complete server with hardened endpoints but no client UI for it — 20 of 22 endpoints are dead on the client. Either wire the social UX (Tier 1-2 above) or delete the dead endpoints and acknowledge this is a single-player sound toy.

Plus 228 lines of dead components (EmojiBubble, OnboardingHint) to delete, and a README that's slightly wrong.
