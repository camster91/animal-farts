# Poot Party v28 — Poot Party TV + Share codes + Welcome screen

## Why v28

v27 shipped with Stripe billing (mock), custom sound upload, and pitch shift — all gated on Cam's env vars and payment account. Those are blocked. v28 picks up three items from the v26 spec §13 deferred list that need zero server and zero Stripe: Poot Party TV (auto-play showcase),4-character share codes (pin sharing via code), and a one-time welcome screen with the 💨 mascot. All three are pure frontend.

## Priority for v28 (in order)

### 1. Poot Party TV

- **What:** An auto-play mode that cycles through all 6 scenes in sequence, playing each thing's default sound as it arrives. A screensaver / showcase for "show grandma what we made" moments.
- **Why now:** Highest delight-per-engineering-cost of the three. It's a single autoplay loop with a scene-cycle timer and a manual next button. No server, no accounts, no data model changes.
- **What it requires:**
  - A toggle in `/parent` to enable/disable TV mode
  - A state machine: `idle → tvMode → cycling → idle`
  - A 5-second timer per scene (configurable in /parent settings once built)
  - A "next scene" button visible during TV mode so the viewer can skip ahead
  - When in TV mode, the 💨 button in the kid's app becomes a "stop TV" exit button
  - No audio mode variant — it plays the default sounds only, in sequence
  - TV mode state stored in sessionStorage (not localStorage) so it doesn't persist across tabs
- **Open questions for Cam:** None — defaults to:
  1. 5s per scene
2. Manual "next scene" button visible during TV mode
  3. No audio-only mode
  4. Toggle in /parent only (not in kid's app)

---

### 2. Share codes

- **What:** A4-character alphanumeric code generated from a kid's pin recordings. A parent can open `/parent?import=<CODE>` on another device to view that pin's metadata (kid name, scene, emoji, timestamp) without accessing the recording itself.
- **Why now:** Parents have asked how to share their kid's creations with grandparents or friends. This is the first step — a code is simpler than account creation and needs zero server. Privacy is default: only metadata travels via code, not the audio.
- **What it requires:**
  - Generate a 4-char code from the pin data using a deterministic pseudo-random function (e.g. base32 encoding of the pin's IndexedDB key, no ambiguous chars: exclude 0/O/1/I)
  - Store the code → pin mapping in localStorage under the profile
  - In `/parent?import=<CODE>`, look up the code and display: kid name, scene name, emoji, timestamp. Do NOT stream or expose the audio blob.
  - A "copy code" button on each pin in `/parent/pins`
  - A "generate code" button on each pin to create one if none exists
  - Codes are per-profile — each kid profile has its own set of codes
- **Open questions for Cam:** None — defaults to:
  1. 4 chars, alphanumeric, no0/O/1/I
  2. Per-profile codes stored in localStorage
3. Import shows metadata only (not audio) — privacy default
  4. Cam can add audio export or server-side code registry in v29 if demand is there

---

### 3. Welcome screen

- **What:** A one-time overlay shown to first-time users on a new device. A large 💨 with eyes, the text "Tap things to make sounds! Tap and hold to make your own.", and a4-second auto-dismiss (or tap to dismiss).
- **Why now:** v26 deferred this to v28. Sam sketched it in v26j. First-time parents and kids need a hint that this app has two interactions: tap (hear) and hold (record). Without it, the hold-to-record gesture has too high a discoverability failure rate.
- **What it requires:**
  - A `hasSeenWelcome` flag in localStorage (per device, not per profile)
  - The welcome screen renders on first app open if the flag is absent
  - 💨 mascot rendered at 2x scale, centered, with dot-eyes and a small smile (as described in the spec §1.2)
  - Two lines of text, 18pt bold: "Tap things to make sounds!" / "Tap and hold to make your own."
  - A small "Got it!" button below the text (tap to dismiss immediately)
  - Auto-dismiss after 4 seconds if the user doesn't tap
  - No "don't show again" checkbox — it's a one-time device flag, not a settings toggle
  - Mascot has a name: **Puff** (the 💨 cloud). Don't be cute about it in the UI — just "Hi, I'm Puff!" in the header
- **Open questions for Cam:** None — defaults to:
  1. Name: Puff
  2. 4s auto-dismiss
  3. One-time per device (localStorage flag)
  4. Text: "Tap things to make sounds! Tap and hold to make your own."

---

## What we're NOT building in v28

- Real Stripe integration (blocked on Cam's env vars — v27 shipped with mock, v29 will close that loop)
- Server-side anything (share codes are localStorage-only, no registry)
- Multi-language support (i18n — v28 per the spec, but we're deferring it one more cycle to ship the three above first)
- Android variant (Capacitor, out of scope per current decision)
- Audio export via share codes (metadata only in v28; Cam can scope audio sharing for v29)
- Poot Party TV audio-only mode (not in scope)

## Success criteria for v28

- Poot Party TV cycles through all 6 scenes at 5s/scene with a working "next scene" button and a working exit (💨) button
- Toggle for TV mode is present and functional in `/parent`
- Share codes are generated per pin, displayed in `/parent/pins`, and importable via `/parent?import=<CODE>` showing metadata only
- Welcome screen appears once per device, auto-dismisses at 4s, and is not shown again on repeat visits
- All v27 features continue to work: upload, pitch shift, premium mock, profile picker, recording, pins
- Bundle size stays ≤ 300KB gzipped JS (TV mode is a state machine + timer, share codes are a localStorage lookup, welcome screen is a conditional render — all small additions)
