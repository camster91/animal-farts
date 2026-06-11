# PootBox v47 — Public Launch Polish Plan

**Date:** 2026-06-11
**Status:** ready to execute
**Goal:** ship a polished public-launch build of PootBox (Animal Farts PWA). Resolve the v46+ UX backlog surfaced in the 2026-06-11 UI/UX review.

**Source of truth:** `docs/v46-plan.md` (architecture, multi-page model), the v40 critique ("are we high quality?"), the v46 skill entry (v46+ backlog), and the live UI/UX review on https://animals.ashbi.ca.

**Stack:** React 19 + Vite + TypeScript, Express + better-sqlite3 server, IndexedDB for client state. Container `animal-farts` on VPS 187.77.26.99, Caddy terminates TLS for `animals.ashbi.ca`.

---

## Vision

Take the v46 multi-page free-floating bubble toy from "works" to "ships." No new architecture — only close the functional gaps, surface the features that exist in code but not in the UI, and add the small polish items a parent or App Store reviewer will notice. The toy should feel like a real game studio shipped it.

**What we are NOT doing in v47:**
- No new physics (the v46 free-floating model ships as-is)
- No new sound library content (30 built-ins stays)
- No Capacitor/Android changes (v45 stays; v47 is web-only)
- No new pages architecture (v46 stays)
- No rewriting the 1,161-line PootBox.tsx (we only add hooks for the gaps, not a refactor)

**Non-goals:**
- Service worker rewrite (already works)
- Audio engine rewrite (already split into audioManager.ts)
- CI / Coolify (gone since 2026-06-11; manual docker build is the deploy path)

---

## The 11 items, grouped by user impact

### Group 1 — Functional gaps a kid/parent will hit immediately

**G1. Page delete** (v46+ backlog item 1)
- **Problem:** `+ menu → Add a new page` works, but there's no way to remove a page. Kid adds 5 pages, can't clean up.
- **Where to fix:** `src/pootbox/PootBox.tsx` (add `onDeletePage`), `src/pootbox/components/PageTabs.tsx` (long-press on a tab → "Delete page?" confirm).
- **Acceptance:**
  - Long-press a page tab (1s) → confirm dialog "Delete 'My Animals'? This can't be undone."
  - Confirm → page removed, blobs for that page's custom recordings also deleted, switches to page:default if active page was deleted
  - Pages with 0 bubbles and only the default page → tab is not long-pressable (no-op, no shake)
  - Persists to IndexedDB across reload
  - All 16 unit tests still pass

**G2. Page rename** (v46+ backlog item 2)
- **Problem:** Tab shows a generic emoji (default 🏠). No way to name "Page 2" → "My Animals". Name field exists in Page type but is never edited.
- **Where to fix:** `src/pootbox/PootBox.tsx` (add `onRenamePage`), `src/pootbox/components/PageTabs.tsx` (long-press a tab → either inline rename or a small bottom-sheet "Rename / Change emoji / Delete").
- **Acceptance:**
  - Long-press tab → bottom sheet with: rename text input, emoji picker (3 quick picks: 🏠 ⭐ 🌙), Delete
  - Name max 24 chars, default empty
  - Tab tooltip / aria-label shows the new name immediately
  - Persists to IndexedDB across reload
- **Merge with G1:** both are "long-press tab → action sheet." One component, one commit.

**G3. Dedup add-to-page** (v46+ backlog item 3)
- **Problem:** Re-adding the same sound creates a duplicate bubble with a new id. Re-adding the Cow sound while Cow is already on the page spawns a second Cow.
- **Where to fix:** `src/pootbox/recordings.ts` (`addBubbleToPage` should check if `b.builtinKey === existing.builtinKey` and skip), `src/pootbox/PootBox.tsx` (handle the "already added" case with a small visual feedback — bubble "shakes no" animation + a toast "Already on this page").
- **Acceptance:**
  - Re-adding a built-in sound that's already on the page → no new bubble, "Already on this page!" toast for 1.5s
  - Re-adding a custom recording → no new bubble, same toast
  - The "duplicate" option from the v3 plan (intentionally adding a second Cow) is **out of scope** for v47

**G4. Empty-page state** (UX item 18)
- **Problem:** A kid adds a new page → blank canvas, no bubbles, no hint, looks broken.
- **Where to fix:** `src/pootbox/PootBox.tsx` or new `src/pootbox/components/EmptyPageHint.tsx`.
- **Acceptance:**
  - New page with 0 bubbles → centered hint "Tap + to add a sound" with a faded + icon, 80% opacity
  - Hint disappears the moment any bubble is added
  - Doesn't appear on the default page (which has 12 bubbles from the start)

**G5. Visible tap feedback on emoji** (v40 critique item, still unfixed)
- **Problem:** Ripple fires at touch point but the emoji itself doesn't visibly react on tap. Ripple off-emoji looks disconnected.
- **Where to fix:** `src/pootbox/components/EmojiBubble.tsx` (add a `pressed` prop-driven scale animation 1.0 → 0.85 → 1.0 over 180ms on tap).
- **Acceptance:**
  - Tap → emoji visibly squishes (scale 0.85) and springs back over 180ms
  - Sound plays at the spring-back point (existing behavior)
  - Doesn't break drag/throw physics
  - Performance: no layout thrash, transform-only animation

### Group 2 — Discoverability (features exist in code but not in UI)

**G6. Library search + category filter chips** (UX item 5, 22)
- **Problem:** 30 sounds in one scrollable list, no search, no category filter. 3yo can't find Burp in 30 flat rows.
- **Where to fix:** `src/pootbox/components/SoundLibrary.tsx` (add search input at top + 4 filter chips "All / Animals / Farts / Silly / Instruments" → "All" + 4 buckets = 5 chips).
- **Acceptance:**
  - Search input (text, 200ms debounce) filters by name match (case-insensitive, substring)
  - Category chips: tap chip → list shows only that bucket. "All" resets
  - Active chip has filled background, others outlined
  - Empty result: "No sounds match" + clear-filters button
  - Search/chip state doesn't persist (resets on close)

**G7. Share-my-page UI** (skill entry: 4-char share codes via POST /api/share, no UI)
- **Problem:** `/api/share` backend works, returns `{ok: true, code: "ABC1"}` for a share. No UI surfaces it.
- **Where to fix:** `src/pootbox/PootBox.tsx` (add a small share button next to the page tab), `src/pootbox/components/ShareSheet.tsx` (new).
- **Acceptance:**
  - Tap share → bottom sheet: "Share 'My Animals' as code ____" with auto-generated 4-char code (uppercase A-Z + 2-9, no 0/1/I/O confusion)
  - Copy-to-clipboard button + the code in big readable type
  - "Load shared page" option in the + menu → input "Enter code" → POST /api/share/lookup/:code → if found, prompt "Add 'Cool Sounds' to your pages?" with the emoji preview → adds as new page
  - Share codes are server-side rate-limited (existing) — error path shows a friendly "Code not found" or "Try again later"
  - Lookup endpoint may not exist on the server — check `server/server.js` first, add `/api/share/lookup/:code` if missing, return the bubble list

**G8. Remove version leak from main UI** (UX item 10, 20)
- **Problem:** Footer shows `💨 PootBox v1.0.0 🔧` to all users. The 🔧 is the only parent gate hint.
- **Where to fix:** `src/pootbox/PootBox.tsx` (remove the version footer from default view, keep the long-press 5s parent gate which already works).
- **Acceptance:**
  - Footer text removed from main canvas
  - The 🔧 long-press parent gate still works (Settings opens after 5s blank-area hold)
  - The version is still in `index.html` meta if needed, or in Settings modal as "v1.0.0"
  - Onboarding hint moves to the center-bottom and stays kid-friendly

### Group 3 — Polish items a parent/reviewer will notice

**G9. Volume slider accessible from main UI** (UX item 14)
- **Problem:** Volume only in Settings (5s hidden long-press). Parent in a quiet room has no quick mute.
- **Where to fix:** Add a small volume icon to the top-right cluster (next to the 🏠 + +) that opens a vertical slider popover.
- **Acceptance:**
  - 🔊 / 🔇 icon (toggles based on volume > 0 vs === 0) in the top-right cluster
  - Tap → small popover with the same volume slider from Settings (0-100%, step 5%)
  - Mute is a single tap (icon → 0%, icon becomes 🔇)
  - State persists in localStorage (same key as Settings: `pootbox-settings-v1`)
  - Reduced-motion toggle stays in Settings only (not main UI)

**G10. Mic pre-prompt + parent onboarding** (UX item 11, 16)
- **Problem:** No first-run message explaining "this app uses your microphone." A parent taps the kid's first record attempt, gets a browser mic prompt with zero context, panics and denies.
- **Where to fix:** `src/pootbox/PootBox.tsx` (new `FirstRunIntro` component shown on the very first visit only).
- **Acceptance:**
  - On first visit (no localStorage flag), instead of the regular canvas, show a 2-screen intro:
    - Screen 1: "👋 Welcome! Tap a sound to start." with a single big 🐄 button. Tap → plays the cow sound and shows the regular canvas.
    - Screen 2 (lazy, only when kid first opens the + menu and taps 🎙): "To record your own sound, we'll ask for the microphone. We only listen while you're recording." with a green "Got it" button. THEN the getUserMedia prompt fires.
  - localStorage flag `pootbox-firstrun-done` set after Screen 1
  - Existing onboarding hint ("Tap a sound!") still shows on first canvas load, then dismisses

**G11. Privacy link + App-Store metadata** (UX item 26, 27)
- **Problem:** No privacy URL, no "Designed for Families" indicator, no "no PII collected" line. Required for Google Play / App Store submission.
- **Where to fix:**
  - New `public/privacy.html` (static page served at `/privacy.html`): one-screen "PootBox Privacy" — "No account, no analytics, no data leaves your device. Microphone is only used while you're recording."
  - Add a "Privacy" link in the Settings modal (small text-link at the bottom)
  - Add `apple-itunes-app` and `google-play-app` meta in `index.html` (left as comments / ready for store URLs)
  - Add `Designed for Families` declaration to `android/app/src/main/AndroidManifest.xml` (modify `<application>` to add `<meta-data android:name="android.max_aspect">` and the families declaration)
- **Acceptance:**
  - `/privacy.html` returns 200 with the text above
  - Settings modal has a "Privacy" link that opens `/privacy.html` in a new tab
  - `public/manifest.webmanifest` gets a `categories: ["entertainment", "education"]` and `"content_rating": "Everyone"` field (PWA manifest spec)
  - No actual data collection is added (the privacy page is honest about current state)

---

## Build steps (one commit per group, in order)

```
v47a: page delete + rename UI (G1 + G2)
v47b: dedup add-to-page + empty-page hint + visible tap feedback (G3 + G4 + G5)
v47c: library search + category chips (G6)
v47d: share-my-page UI + server lookup endpoint (G7)
v47e: volume slider in main UI + remove version footer (G8 + G9)
v47f: first-run intro + mic pre-prompt (G10)
v47g: privacy page + App-Store metadata (G11)
v47h: redeploy image to VPS (manual docker build)
```

**Build gates (each commit must pass before next):**
- `npm run build` clean (TypeScript + Vite)
- `npm run lint` 0 errors
- `npm test` 16/16 pass (with new tests added for new pure functions)
- Live vision check on the redeployed site

**Test additions per commit (each is a new test file):**
- `v47a`: `tests/unit-page-tabs.test.mjs` — rename + delete pure helpers
- `v47b`: `tests/unit-tap-feedback.test.mjs` — pressed state shape
- `v47c`: `tests/unit-library-filter.test.mjs` — filter+search pure function
- `v47d`: `tests/unit-share-code.test.mjs` — code gen is 4 chars, no 0/1/I/O
- `v47e`: none (UI-only)
- `v47f`: none (UI-only)
- `v47g`: none (static page)

---

## Risk register

| Risk | Mitigation |
|---|---|
| `addBubbleToPage` dedup breaks the v3-plan "intentional duplicate" feature | It's a v47 out-of-scope item; we re-add it in v48 if needed |
| Volume slider in main UI crowds the top-right cluster | Move it to the bottom-left, away from the page tabs; keep page tabs + add menu at top |
| Share codes are guessable (4 chars, 32-choices = 1M space) | Server already rate-limits; that's enough. v48 can add per-user secrets if abuse happens |
| First-run intro adds friction for repeat visitors | localStorage flag, never shows again |
| Privacy page contradicts any future analytics | We're not adding analytics in v47; if v48 adds any, the page is updated first |

---

## Verification (after v47h redeploy)

- [ ] `curl https://animals.ashbi.ca/` returns 200, new title
- [ ] `curl https://animals.ashbi.ca/api/health` returns ok
- [ ] `curl https://animals.ashbi.ca/privacy.html` returns 200 with the privacy text
- [ ] `curl -X POST https://animals.ashbi.ca/api/share` returns a valid 4-char code
- [ ] `curl https://animals.ashbi.ca/api/share/lookup/<code>` returns the bubbles list
- [ ] Live browser walkthrough:
  - Tap a sound → plays + squish animation
  - Open + menu → see all 4 options
  - Open library → search "burp" → only Burp shows → tap chip "Farts" → only 6 show
  - Add a new page → empty-state hint shows → add a sound → hint disappears
  - Long-press the new page tab → action sheet → rename to "Test" → tab tooltip shows "Test"
  - Try to add the same sound twice → "Already on this page!" toast
  - Tap share icon on "Test" → code shown → tap "Load shared" → enter code → page added
  - Open volume slider → mute → icon becomes 🔇
  - Long-press blank 5s → Settings opens → see "Privacy" link
  - Hard reload → first-run intro shows → tap 🐄 → canvas
- [ ] All 16 existing tests + new tests pass
- [ ] No console errors in browser

---

## Out of scope (deferred to v48+)

- Recording flow reduction (4 steps → 3)
- iOS Safari swipe-back conflict with blank long-press
- "No made-by / about / contact" page
- Built-in sound "categories in default home page" (currently home shows only Animals)
- Share codes with longer entropy / per-user secrets
- Migration to a real backend (Express stays, just better-sqlite3 + a few endpoints)
- Service worker update prompt (PWA install prompt)
- Capacitor Android rebuild (v45 stays; Android check link still works for the install flow)
