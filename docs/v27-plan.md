# Poot Party v27 — Premium tier + Custom sound upload + Voice pitch shift

## Why v27

v26 shipped with a working kid's app, recording, pins, and /parent dashboard — but the premium tier was mocked UI with no real purchase path. v27 closes that loop: real Stripe billing, a custom sound upload feature parents have already asked for, and pitch shift so kids can make their recordings sillier or deeper. All three are self-contained on the frontend; none require a new server beyond the Stripe webhook.

## Priority for v27 (in order)

### 1. Real Stripe / premium tier
- **What:** Wire up Lemon Squeezy (or Stripe Checkout) so parents can actually buy the $1.99/mo or $14.99/yr plan. Add a Stripe webhook handler that flips the premium flag in localStorage.
- **Why now:** Every other premium feature in this spec is blocked by the same thing — we have locked UI and no purchase flow. Shipping pitch shift or custom upload without a way to pay for them is half-measures.
- **What it requires:**
  - Lemon Squeezy account + product setup (or Stripe account)
  - Checkout button in `/parent/about` → opens Lemon Squeezy overlay
  - Webhook endpoint: `POST /api/stripe-webhook` (or Lemon Squeezy equivalent) that verifies signature and sets `premium: true` in localStorage
  - Test the purchase flow end-to-end before calling it done
  - Premium flag already exists in localStorage (v26 mocked it); the webhook is the only new backend piece
- **Open questions for Cam:**
  1. Lemon Squeezy or Stripe? (LS is indie-friendlier: no Stripe dashboard, handles international tax forms)
  2. Do you already have a Lemon Squeezy account, or do we need to create one?
  3. Should the14-day free trial start on first profile creation (per the v26 spec), or on successful payment?

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
- **Open questions for Cam:**
  4. Should uploaded sounds be per-profile or shared across all profiles on the device?
5. Any content restrictions we should enforce on upload? (Size cap is 5MB — is that right?)

### 3. Voice pitch shift on kid's recordings
- **What:** In the `/parent/recordings` list, add a pitch-shift control (–1 octave to +1 octave in steps) that re-encodes the kid's recording at a different playback rate. Applied as a playback effect, not a permanent change to the stored audio.
- **Why now:** It makes recordings more playful without requiring the kid to re-record. A kid who records a "moo" can pitch it up to a squeak or down to a monster-bass voice. It's a single Web Audio operation — `playbackRate` on the audio element — and it has high delight-per-engineering-cost.
- **What it requires:**
  - In `RecordingsList.tsx`, add a pitch slider (–12 to +12 semitones) per recording
  - Web Audio API: `AudioContext.createBufferSource()` + `playbackRate` to shift pitch at runtime
  - No new storage needed — the pitch-shifted version plays from the same blob, same IndexedDB record
  - If the kid is too young to use the slider, the parent can set it from `/parent/recordings`
  - The pitch preference is stored per recording in IndexedDB (`pitchShift: number`)
  - Premium gate: 🔒 "Premium" on the pitch slider if not premium
- **Open questions for Cam:**
  6. Should the pitch-shift apply to the pin/thing playback in the kid's app too, or only in the parent preview?
7. Is –12 to +12 semitones the right range, or too extreme for young kids?

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
