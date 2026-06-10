# PootBox v3.0 — Public Launch Plan

## Vision

A sound toy for kids that feels like a real game studio made it, not "an agent over the weekend." Every interaction should feel intentional. The kid should never wonder "what do I do now?" — the toy reveals itself.

## Core design changes (this release)

### 1. Free-floating emoji bubbles (no grid)

**Old:** 4×3 grid of static, evenly-spaced circles. Deterministic. Hero circle pulses. Looks like a form, not a toy.

**New:** 12-24 emoji bubbles spawn in random positions across the canvas. Each floats gently (zero-G, slow drift, no two circles take the same path). When idle, **they don't make sound**. Sound only plays on touch. Tapping one gives a tap reaction (squish, then it bounces off in a random direction). They collide with each other and with walls.

**Why this works for a 3-year-old:**
- "Magical" feeling: things floating in space, not a list
- "Surprise": the emojis move, where they go next is unpredictable
- "I can make them do this" agency: my tap = the thing I chose just bounced
- More natural cognitive model for kids: this is a pond, not a menu

### 2. Tap-only sound (no auto-play)

The current code does random drift. We're keeping the gentle drift but **drift never plays sound**. Sound = tap, drag, or collision. Silence on idle is intentional — silence makes the next tap feel like an event.

**Implementation:**
- Bump the per-circle `lastDriftedAt` (drift is by random nudge, not continuous)
- Collision sound gate: only when the user touched one of the circles in the last 500ms
- (Already partly in v32b; tighten the gate)

### 3. Add / remove sounds menu (top-right)

**Old:** Single `+` button bottom-right. Tap, get full-screen recording flow. No way to remove built-in sounds.

**New:** Top-right `•••` button opens a "Sounds" menu. From there:

- **Add a sound:** three sub-flows
  - **Record your own** — same recording flow as before (mic → emoji picker)
  - **From the library** — pick from ~30 built-in sounds we ship (cow, dog, cat, pig, duck, lion, frog, monkey, horse, elephant, rooster, bear + 18 more like "burp", "fart-wet", "squeaky-toy", "drum", "bell", "magic", "rocket", etc.)
  - **Pick a duplicate** of an existing one (easy for kids to have two of the same animal)
- **Remove a sound:** any emoji in the menu can be deleted. Built-in sounds hide from menu (can't delete) but **can be hidden** so the kid only sees the ones they want.

**Limit per screen:** the menu has a "max on screen" toggle (default 8, max 12). Adding a sound past the cap auto-archives the oldest or asks. Kid can have unlimited sounds, just only 8-12 visible at once.

**Persistence:** IndexedDB, same as today. Menu shows ALL recorded sounds + ALL built-in sounds. Sounds are stored by id (`built-in:cow` vs `custom:abc123`). Visible/hidden flag is per-profile.

### 4. Multi-screen support (top-right "Pages" or arrow nav)

Each screen is a full-canvas "room" containing up to 12 emoji bubbles. Top-right has a small tab strip (iOS-style segmented control or a chevron) showing all screens. New screens added from the sounds menu: "Add new page" → kid names it (or picks emoji) → empty canvas.

**Visual style:** a thin bar at the top with dots, or a 1-emoji label per page. Sago Mini uses dots, but for a kid who named their pages, emoji labels work better.

**Default state:** 1 page with the 12 built-ins. Add a 2nd page from the menu.

**Why this matters:**
- The 8-12 cap means kids don't get overwhelmed
- Different "rooms" feel like different toys
- Recording "My dog says woof" goes on the page called "My Animals"
- Bedtime sounds on a page called "Sleepy Time"

**Max pages:** 6. Past that, the "Add page" button is disabled. Reasonable for a sound toy, prevents clutter.

**Persistence:** same IndexedDB, stored as `pages: Page[]` where `Page = { id, name, emojiSlots: CustomCircle[] }`. Built-in page is `page:default`.

### 5. "Real game studio" polish

Small things that say "this was made by a team that cares":

- **First-time onboarding** (already shipped) but rewrite to:
  - Tap the **first emoji you see** (not the one in the center). The "first one" is whatever the kid touches first.
  - Show "Tap a sound!" on top of the canvas, semi-transparent, with a hand 👆 emoji pointing at the first emoji the kid looks at
  - Auto-dismiss after first tap

- **Multi-tap delight:**
  - First tap: ripple + sound
  - Second tap on same emoji within 500ms: bigger ripple + color flash + "again again!" tiny emoji spawn
  - Third: shake the whole emoji
  - (Keeps the existing combo system; this is per-emoji, not cross-emoji)

- **Settings (still hidden, but easier to find):**
  - 5-second hold on empty area (current)
  - Triple-tap the 💨 footer (current)
  - **NEW:** shake the device 3 times within 2 seconds → settings. Kids can shake things, parents know this pattern.

- **Microphone button redesign:**
  - Tap + → modal: "Make your own sound" with big red mic
  - Inside modal: tabs at the top: **Record** | **Pick from library**
  - Record: same flow
  - Library: grid of ~30 emoji, tap to add
  - After selection (either way), a small "name this?" input (optional, default = emoji name)

- **Visual:**
  - All circles have a subtle white/cream ring (frosted glass)
  - Soft drop-shadow under each bubble
  - When idle, slow shimmer on the background gradient (4-second cycle)
  - Sound icons inside the bubbles (small ♪ when playing, 0.6s)

- **Empty-state copy:** when a screen has 0 emoji, show a big "Tap + to add your first sound" hint, not just an empty canvas.

### 6. What to drop

The simplification pass (v44) was good. Don't re-add the cut features. The new design is a strict superset:

- ❌ **Drop the static grid layout** — replaced by random spawn
- ❌ **Drop the "hero circle pulses" pattern** — replaced by "all circles gently float, none special"
- ❌ **Drop `tappedRecently` per-emoji flash** (already cut in v44) — the per-emoji multi-tap above replaces it
- ❌ **Drop `watermarkTapCount` triple-tap** — shake-to-settings replaces it
- ❌ **Drop `lastTapPushedAt` tap-push** (already cut) — bubbles don't need radial push
- ❌ **Drop `HatchAnimal` 1.5s hold** (already cut) — no equivalent

## Non-goals (out of scope this release)

- Cloud sync (no, this is local-only for kids' privacy — no accounts)
- Real-time multiplayer (no)
- Sound effects beyond the 30-shipped-and-∞-user-recorded library (no)
- Custom sound FX (pitch/speed/reverb) — already cut
- iOS-specific code paths (we ship the web build; iPhone works in Safari)
- App Store submission / signing / Play Store metadata — separate workstream

## File structure (post-refactor)

```
src/pootbox/
├── types.ts          # Page, CustomCircle, BuiltInCircle, etc.
├── constants.ts     # BUILT_IN_SOUNDS array, MAX_PER_SCREEN, MAX_PAGES
├── audioManager.ts   # playSingle, stopAllSounds (unchanged)
├── recordings.ts     # IDB page persistence (refactored for pages)
├── settings.ts       # shake detection, settings backdoor
├── physics.ts        # extracted physics step (useFrame-style)
├── effects.ts        # extracted tap effect spawners
├── pages.ts          # page CRUD: createPage, deletePage, addSound, removeSound
├── PootBox.tsx       # main composition (target: < 800 lines)
└── components/
    ├── EmojiBubble.tsx
    ├── BubbleCanvas.tsx
    ├── PageTabs.tsx
    ├── AddSoundMenu.tsx
    ├── RecordSheet.tsx
    ├── SoundLibrary.tsx
    └── OnboardingHint.tsx
```

Target: **< 800 lines in PootBox.tsx**, no file > 400 lines.

## Build steps (in order, each as its own commit)

### Step 1: Plan + cleanup (this commit)

- This document (`docs/v46-plan.md`)
- Drop the unused `audio/engine.ts` (replaced by audioManager)
- No code changes yet

### Step 2: Types + constants + data layer (v46a)

- New `types.ts` with `Page`, `BubbleState`, `Screen`, `BuiltInSound`
- New `constants.ts` with `BUILT_IN_SOUNDS` (~30 entries), `MAX_PER_SCREEN = 8`, `MAX_PAGES = 6`, `MIN_DRIFT_INTERVAL_MS = 4000`
- New `recordings.ts` rewrite: `loadAllPages()`, `savePage(page)`, `deletePage(id)`, `addSoundToPage(pageId, sound)`, `removeSoundFromPage(pageId, soundId)`, `archiveSound(soundId)` — all single-IDB, all async, all typed
- New `pages.ts` for in-memory page CRUD

### Step 3: Physics (v46b)

- Extract `physics.ts` with `stepPhysics(circles, dt, viewport)` — pure function, no React
- Free-floating bubbles: random spawn, zero-G drift, wall bounce, circle-circle collision
- Tightened collision sound gate: only when user touched in last 500ms (per-circle)
- NO random drift that auto-plays sound (drift is silent)

### Step 4: Effects (v46c)

- Extract `effects.ts` with `spawnTapRipple()`, `spawnStarBurst()`, `spawnConfetti()`, `spawnFloatingEmoji()` — all pure functions
- Refactor existing ripple/spark/burst code from PootBox.tsx into this module
- Export a `useEffects` hook that manages the effect state (ripples, sparks, confetti, floating emoji)

### Step 5: Components (v46d)

- New `EmojiBubble.tsx` — single bubble, taps to play sound
- New `BubbleCanvas.tsx` — renders all bubbles on a page, handles physics loop
- New `PageTabs.tsx` — top-right segmented control showing all pages
- New `AddSoundMenu.tsx` — modal with Record | Library tabs
- New `RecordSheet.tsx` — extracted recording UI from PootBox.tsx
- New `SoundLibrary.tsx` — extracted emoji picker (30 built-in sounds)
- New `OnboardingHint.tsx` — "Tap a sound!" with 👆 pointing at nearest emoji

### Step 6: PootBox.tsx composition (v46e)

- `PootBox.tsx` becomes mostly composition: state at the top, render at the bottom, ~600 lines
- Wire up all the components
- Shake-to-settings: `useEffect` with `devicemotion` event
- All handlers delegate to the modules

### Step 7: Android build + ship (v46)

- Rebuild APK
- GitHub release v2.1 (incremental) with the new APK

## Risks

- **Random spawn can place circles inside each other at first frame.** Fix: spawn with collision check, retry up to 100 times.
- **Multi-page state can grow unbounded.** Fix: cap at 6 pages, cap at 30 sounds per page.
- **The "shake to open settings" can fire on stroller push / bumpy car ride.** Fix: require 3 distinct shake events within 2s, debounce.
- **Sound library of 30 needs asset files.** Currently `public/sounds/` has 388 mp3s. The library picker can be backed by these. Curate the list to 30 that are clearly distinct and kid-friendly.
- **Bundle size.** Currently 223KB. With the bigger types + 7 new components, target ≤ 280KB. If it grows to 350KB, lazy-load the library picker.

## Success criteria

- **Engagement:** kid spends 5+ minutes without asking for help
- **Sound toy feel:** no "form" or "list" perception; bubbles feel alive
- **Sound is intentional:** silence when idle, every sound is a deliberate tap
- **No overwhelm:** 8-bubble default cap, max 12, max 6 pages
- **Looks like a real game dev company:** subtle motion, frosted glass, no jank, no "agent" tells
- **All existing tests pass + new tests for pages, library, shake**

## Estimated effort

- Step 1 (this): 1 hour ✅
- Steps 2-6: 4-5 days of focused work (probably 1-2 agents running in parallel with clear contracts)
- Step 7: 1 hour

**Total: 1 week to ship-ready, assuming kid test feedback in the middle is positive.**
