# Poot Party v27 — Premium tier + Custom sound upload + Voice pitch shift

## Decisions (Maya, 2026-06-06, default-on-no-response)

1. **Payment processor:** Stripe Checkout (not Lemon Squeezy) — fits Cam's existing Coolify + GitHub + npm infra
2. **Stripe account:** No account yet — Diego builds with env vars, mocks checkout in dev with "DEV: simulate premium" toggle
3. **14-day trial trigger:** Starts on first successful payment, not profile creation — industry standard
4. **Uploaded sounds:** Per-profile storage — parents customize each kid's experience; shared library is v28+
5. **Upload cap:** 5MB — ≈30 seconds of low-bitrate MP3, sufficient for any kid recording
6. **Pitch shift scope:** Parent preview only — not applied in kid's app playback
7. **Pitch range:** ±6 semitones (one octave down to one up) — ±12 is too dissonant for young kids; ±6 = perfect fourth, recognizable and playful

## Why v27

v26 shipped with a working kid's app, recording, pins, and /parent dashboard — but the premium tier was mocked UI with no real purchase path. v27 closes that loop: real Stripe billing, a custom sound upload feature parents have already asked for, and pitch shift so kids can make their recordings sillier or deeper. All three are self-contained on the frontend; none require a new server beyond the Stripe webhook.

## Priority for v27 (in order)

### Decision: Stripe Checkout (not Lemon Squeezy)
**Rationale:** Cam's existing infra is Coolify + GitHub + npm. Stripe's CLI + webhook signing fits the deploy pattern without adding a new vendor.
**Override path:** Cam creates a Lemon Squeezy account instead → change `STRIPE_*` env vars to LS product ID + webhook secret and update the checkout button in `/parent/about`.

### 2. Do you have a Lemon Squeezy account already?

### Decision: No — Diego builds with env vars and mocks checkout in dev
**Rationale:** No Stripe or LS account exists yet. Diego wires up `STRIPE_PUBLIC_KEY` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` from env; locally, a "DEV: simulate premium" flag flips the premium flag without a real purchase.
**Override path:** If Cam has an existing LS account, he provides the store ID + webhook secret and Diego switches from Stripe to LS SDK.

### 3. 14-day free trial — on first profile creation, or on first successful payment?

### Decision: Trial starts on first successful payment, not profile creation
**Rationale:** Industry standard. Profile creation is free; the trial is the paid product and should start when the parent actually pays.
**Override path:** Cam changes `trialStartTrigger` in the billing hook — `'payment'` (default) or `'profileCreation'`.

### 2. Custom sound upload (parent drops in MP3)
- **What:** In `/parent/library`, add an "Upload custom sound" button — parent picks an MP3 from their device, it gets stored in IndexedDB and attached to a thing or scene of their choice.
- **Why now:** Parents have asked for this. It's a clear premium use case that justifies the $14.99/yr. It's also bounded scope — file picker → validate → store → assign to a thing.
- **What it requires:**
  - File input (`<input type="file" accept="audio/mp3,audio/mpeg">`) in the parent sound library UI
  - Validation: MP3 only, max 5MB, auto-transcode to WebM/Opus for consistent playback
  - UI: parent picks which thing in which scene to attach the sound to (from a scene/thing picker)
  - The uploaded sound becomes part of that thing's sound pool — plays alongside the defaults
  - Premium gate: the upload button shows a 🔒 with "Premium" badge if `premium !== true` in localStorage
  - `Sam` needs to design the upload flow UI (scene picker + thing picker + drop zone)

#### Decision: Uploaded sounds are per-profile (not shared)
**Rationale:** Parents will customize each kid's experience; a shared cross-profile library adds data model complexity and is better suited for v28+.
**Override path:** Cam wants shared → change storage key from `profile_<id>_sounds` to `device_sounds` in IndexedDB.

#### Decision: 5MB upload cap
**Rationale:** 5MB ≈ 30 seconds of low-bitrate MP3, long enough for any kid recording. Increase in settings if demand surfaces.
**Override path:** Cam changes `MAX_UPLOAD_BYTES` constant in `UploadSound.tsx`.

### 3. Voice pitch shift on kid's recordings
- **What:** In the `/parent/recordings` list, add a pitch-shift control (–6 to +6 semitones) that re-encodes the kid's recording at a different playback rate. Applied as a playback effect, not a permanent change to the stored audio.
- **Why now:** It makes recordings more playful without requiring the kid to re-record. A kid who records a "moo" can pitch it up to a squeak or down to a monster-bass voice. It's a single Web Audio operation — `playbackRate` on the audio element — and it has high delight-per-engineering-cost.
- **What it requires:**
  - In `RecordingsList.tsx`, add a pitch slider (–6 to +6 semitones) per recording
  - Web Audio API: `AudioContext.createBufferSource()` + `playbackRate` to shift pitch at runtime
  - No new storage needed — the pitch-shifted version plays from the same blob, same IndexedDB record
  - If the kid is too young to use the slider, the parent can set it from `/parent/recordings`
  - The pitch preference is stored per recording in IndexedDB (`pitchShift: number`)
  - Premium gate: 🔒 "Premium" on the pitch slider if not premium

#### Decision: Pitch shift applies to parent preview only (not kid's app)
**Rationale:** Keep the kid's experience simple. Pitch shift is a "what does my kid's recording sound like as a chipmunk" parent tool, not a kid-facing feature.
**Override path:** Cam wants it in kid's app too → add `pitchShift` prop to `<Thing>` / `<Pin>` and pass it through to the audio element.

#### Decision: ±6 semitones range (not ±12)
**Rationale:** ±12 semitones = full octave, can sound weird or dissonant for young kids. ±6 = a perfect fourth up or down, recognizable and playful without being alarming.
**Override path:** Cam widens to ±12 → change `PITCH_MIN`/`PITCH_MAX` constants in `PitchShiftSlider.tsx`.

## What we're NOT building in v27

- **Social features** (share recordings via 4-char code, follow, public gallery) — needs server + moderation + COPPA compliance. Punted to v28+.
- **Cross-device sync** — needs a server to store and serve recordings. Not in v27.
- **AI sound generation** — needs an API integration (Replicate, ElevenLabs, etc.) and prompt safety layer. Not in v27.
- **Multi-language (i18n)** — explicitly v28 per the spec. Not in v27.
- **Poot Party TV** (auto-play mode) — auto-play across all scenes is a nice ambient mode but lower priority than monetization.
- **Android variant** — Cam hasn't decided. Still open for v28 or skip.

## Success criteria for v27

- Parent can purchase the $14.99/yr plan via Lemon Squeezy/Stripe and the premium flag persists across sessions
- Locked 🔒 features (3 profiles, custom upload, pitch shift) unlock after purchase
- Parent can upload an MP3 from their device and hear it play on a thing in the kid's app
- Pitch slider in `/parent/recordings` changes the playback pitch of a kid's recording without modifying the stored blob
- All v26 features continue to work (no regression in kid's app, recording, pins, /parent dashboard)
- Bundle size stays ≤ 300KB gzipped JS (pitch shift is a small Web Audio addition, not a new library)
