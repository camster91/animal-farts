# PootBox v48 — Remaining items + Launch polish

**Date:** 2026-06-11
**Status:** ready to execute
**Goal:** close the 4 v47 leftovers + ship the 6 v48 items the plan deferred. Public launch fully shippable.

---

## Vision

After v47, the app is functional but has clear gaps:
- The 4 v47 items I deferred mid-build (Privacy link in Settings, dead state, ShareSheet lookup wiring, real verification)
- The recording flow is 4 steps; Sago Mini does it in 3
- The home page only shows Animals — a kid who never opens the library never sees the other 4 buckets
- No "made by / about" page = no attribution
- PWA install prompt isn't handled (Chrome shows the bar but our app ignores it)
- Service worker can update behind the user's back without notifying them
- Android APK is 2 days old; the v47 web changes aren't in the APK

v48 ships all of these.

---

## 10 items, in order

### v47 leftovers (4 commits)

**L1. Remove `pageRenames` dead state** — `src/pootbox/PootBox.tsx`. The v47f agent added `const [pageRenames, setPageRenames] = useState(0)` and never read or set it. Remove both lines.

**L2. SettingsModal "Privacy" link** — `src/pootbox/SettingsModal.tsx`. Add a small text-link at the bottom of the modal (above the "This menu only appears after holding the background for 5 seconds" note) that says "Privacy" and opens `/privacy.html` in a new tab.

**L3. Wire ShareSheet lookup** — `src/pootbox/PootBox.tsx`. The ShareSheet already accepts `onLookupCode` and `onAddAsPage` props. Wire them in PootBox:
- `onLookupCode: async (code) => { const r = await fetch(`${API_BASE}/api/share/${code}`); if (!r.ok) return null; return await r.json(); }`
- `onAddAsPage: (data) => { addPageFromShareData(data); }`
- Need a new function `addPageFromShareData(data)` in PootBox that creates a new Page with 1 bubble referencing the shared sound's audioUrl.

Where is `API_BASE`? It's whatever the lookup uses. Look at the existing /api calls in PootBox (if any) or use `window.location.origin` (works for the live site and the tunnel).

**L4. End-to-end verify on live site** — final agent pass (after L1-L3 ship): live walkthrough of every v47 feature, take vision check, fix any visual regression.

### v48 items (6 commits)

**N1. Recording flow 4→3 steps** — collapse "pick emoji" into the recording flow. Currently: tap 🎙 → record → tap "Save" → emoji picker sheet → tap emoji → bubble. New: tap 🎙 → record → tap "Save" → inline emoji strip (12 quick picks: 🐄 🐕 🐈 🐖 🦆 🦁 🐸 🐒 🐎 🐘 🐓 🐻 + 🎲 randomize) → tap one → bubble spawned. No separate sheet.

Where to edit:
- `src/pootbox/components/RecordSheet.tsx` — add the inline emoji strip after the save button
- `src/pootbox/PootBox.tsx` — adjust the state machine: skip the `picking` phase

**N2. Home page categories** — let the user pick which category the home page shows. Currently the home page always shows the 12 animal built-ins. New: a small chip row at the top of the canvas (or inside PageTabs area) that lets the user toggle which bucket is "default" for new pages. Default is "Animals" (backward compat for users with existing pages). Setting persists in localStorage.

Simplest implementation:
- Add a `homeCategory` state in PootBox (localStorage-backed, default "animal")
- The default page (id: "page:default") bubbles list = `BUILT_IN_SOUNDS.filter(s => s.bucket === homeCategory).map(...)` instead of the hardcoded animal filter
- A small UI control: a 5-chip row inside the home page tab area (only show on the default page)
- The user can change it; new default page content updates

Where to edit: `src/pootbox/recordings.ts` (`createDefaultPage` takes a `homeCategory` param) and `src/pootbox/PootBox.tsx` (the chip row + the localStorage hook).

**N3. About page** — `public/about.html` (static, same style as privacy.html):
- "Made by Cameron Ashley / Ashbi Design" (one line)
- "Sound clips from public domain libraries" (one line)
- "Source code: github.com/camster91/animal-farts" (link)
- "Contact: hello@pootbox.app" (mailto link)
- "Privacy: /privacy.html" (link)
- "© 2026 Ashbi Design" footer

Wire it: Settings modal gets an "About" link next to the Privacy link. Server gets a `/about.html` route.

**N4. PWA install prompt** — `src/main.tsx` or new `src/pootbox/components/InstallPrompt.tsx`:
- Listen for `window.beforeinstallprompt`, save the event
- Show a small banner at the bottom: "📱 Add PootBox to your home screen" with "Install" / "Not now" buttons
- Tap Install → `event.prompt()` then `await event.userChoice`
- Track dismissal in localStorage to avoid pestering

**N5. Service worker update prompt** — `src/main.tsx`:
- Listen for `serviceWorker.controller` change (i.e., new SW takes over)
- When detected, show a small banner: "New version available — Reload" with a "Reload" button
- The current SW is at `public/sw.js`; check its `CACHE_NAME` and bump if needed (the v47 wave did not bump it)

**N6. Capacitor Android APK rebuild** — rebuild `app-debug.apk` against the v47 web bundle so the Android install test works with the latest code.
- `cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew assembleDebug`
- Result: `android/app/build/outputs/apk/debug/app-debug.apk`
- Verify with `aapt dump permissions app-debug.apk` that RECORD_AUDIO is still in the manifest

---

## Build steps (one commit per item, in order)

```
v48-l1: remove pageRenames dead state
v48-l2: SettingsModal Privacy link
v48-l3: ShareSheet lookup wired
v48-n1: recording flow 4→3 steps
v48-n2: home page categories
v48-n3: about page
v48-n4: PWA install prompt
v48-n5: SW update prompt
v48-n6: Capacitor Android APK rebuild
v48-deploy: redeploy image to VPS
```

**Build gates (each commit must pass before next):**
- `npm run build` clean
- `npm run lint` 0 errors
- `npm test` 53+ pass (with new tests for any new pure helpers)
- Live vision check on the redeployed site (after v48-deploy)

**Test additions per commit (only if pure helpers are added):**
- L1, L2, L3: none (UI wiring)
- N1: `tests/unit-recording-flow.test.mjs` if pure helpers added
- N2: `tests/unit-default-page.test.mjs` for the new `createDefaultPage(homeCategory)` signature
- N3-N5: none (static/UI)
- N6: APK size assertion (the build output should be > 50MB)

---

## Risk register

| Risk | Mitigation |
|---|---|
| PWA install prompt banner covers the canvas | Position at bottom, max 60px tall, dismiss button |
| SW update reload interrupts recording | Check if MediaRecorder is active before reloading |
| Home category change on existing user's browser breaks the default page | Only apply to NEW pages; existing pages retain their current bubbles |
| `addPageFromShareData` (L3) conflicts with the v47 onAddPage state machine | Use the same onAddPage pattern, just with a different bubbles array |
| Android rebuild fails due to JDK path | Use the explicit `JAVA_HOME=/opt/homebrew/opt/openjdk@21` from the v45 skill |

---

## Verification (after v48-deploy)

- [ ] No "pageRenames" in source
- [ ] Settings modal has a Privacy link that opens `/privacy.html` in a new tab
- [ ] Settings modal has an About link that opens `/about.html` in a new tab
- [ ] `curl https://animals.ashbi.ca/about.html` returns 200
- [ ] `curl https://animals.ashbi.ca/privacy.html` returns 200
- [ ] ShareSheet lookup mode: enter "DRD5" (a code from earlier) → returns the sound → tap "Add as new page" → new page appears with the sound
- [ ] Recording: tap 🎙 → record → tap Save → emoji strip appears → tap an emoji → bubble spawned (3 steps, not 4)
- [ ] Home page: tap the home category chip "Farts" → page bubbles become the 6 fart sounds
- [ ] PWA install: Chrome dev tools → Application → "Install" available
- [ ] SW update: change `CACHE_NAME` in sw.js → reload → see update banner
- [ ] Android APK: `app-debug.apk` exists, > 50MB, RECORD_AUDIO permission present
- [ ] All 53 existing tests + new tests pass
- [ ] No console errors in browser

---

## Out of scope (deferred to v49+)

- iOS Safari swipe-back conflict with blank long-press
- Share codes with longer entropy / per-user secrets
- Migration to a real backend (Express stays)
- "No made-by / about / contact" — wait, this IS in scope as N3
- Migration from PootBox to a proper CMS for the About/Privacy pages
