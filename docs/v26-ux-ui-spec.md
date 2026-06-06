# Poot Party — Full UX/UI Spec

> Status: **Planning.** No code yet. Cam is reviewing this before we build.
> Last updated: 2026-06-05
> Version: v26 spec

---

## 0. The product in one sentence

A kids' sound-toy app where the kid taps things in a world to hear sounds, then **makes their own** by recording over the default sounds and dropping new emoji "pins" in the scene. Branded as **Poot Party**.

---

## 1. Brand & visual identity

### 1.1 Name & tagline
- **App name:** Poot Party
- **Tagline:** "Make your own animal noises."
- **Voice:** silly but not gross. Warm. Parent-defensible in a school pickup line.

### 1.2 Mascot
- A smiling, round **💨 cloud** with two small dot-eyes and a small smile.
- The mascot appears in:
  - The app icon (gold background, 💨 center, simple eyes/smile)
  - The empty-state of a scene (a sleeping 💨)
  - The "tap to record" hint (a pulsing 💨 next to your finger)
  - The /parent dashboard header

### 1.3 Color palette
- **Gold** `#fbbf24` — primary brand color, the 💨 hue
- **Sky blue** `#7dd3fc` — secondary, the "happy" color
- **Cream** `#fffbeb` — background, friendly paper-like
- **Soft pink** `#fda4af` — reactions, love, success
- **Charcoal** `#1f2937` — text on light surfaces
- **White** — text on illustration backgrounds, with a 30% black scrim under it for legibility

### 1.4 Typography
- **Wordmark:** "Poot Party" in a custom rounded display font. The 'i' in "Party" is replaced with a 💨.
- **In-app text:** system font stack (San Francisco on iOS, Roboto on Android, Inter web fallback). 2 weights only: regular + bold.
- **Kid labels on things:** bold, 14-16pt, white with subtle drop shadow. Always readable over the illustrated scene.
- **No small text on the kid's screen.** A 4-year-old can't read. If text appears on the kid screen, it's ≤ 18pt and ≤ 4 words. Otherwise it's an icon or emoji.

### 1.5 Sound identity
- The "ui tap" sound: a soft "boop" (~80ms, low-pass filtered) on every tap. Confirms the touch landed.
- The "ui success" sound: a soft chime (~200ms) when the kid records a sound. The "you made something" reward.
- The "scene transition" sound: a soft whoosh (~300ms) when swiping between scenes.
- The kid's sounds themselves: the 388 + their recordings. Always full-volume, no normalization.

---

## 2. The kid's app — `/`

### 2.1 The principle

**One screen. One screen only.** No tabs, no nav, no settings, no "My Stuff." The screen IS the app.

The kid opens the app, sees a world (an illustrated scene), taps things, hears sounds, makes their own. That's it.

The only chrome visible at any time:
- A small 🏆 number bottom-right (fades to 30% after 5s of no interaction)
- A floating 💨 button bottom-left (always visible, primary "add new pin" action)

That's it. No record button. No random. No filter chips. No back button.

### 2.2 The screen layout (idle state)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│ ☁️                                                     │ ← sky
│                                                         │
│                  [16:9 illustrated scene]                │ ← the world
│                                                         │
│       🐄 (cow, big emoji, sitting in grass)             │ ← positioned thing
│                                                         │
│                  🐖 (pig, mud patch)                     │
│                                                         │
│                              🚜 (tractor, in distance)   │
│                                                         │
│   🦆 (duck, pond area)                                  │
│                                                         │
│                                                         │
│   💨                                          🏆 12    │ ← bottom chrome
│  (add pin)                              (sounds heard)│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Screen geometry

- **Viewport:** 100vw × 100vh. Full-bleed. No margin.
- **Scene illustration:** `position: absolute; inset: 0; background: url('/scenes/<id>.jpg') bg-cover bg-center`. The 16:9 JPEG fills the viewport; the 5% letterbox on each side (since viewport is taller than 16:9) shows the sky/horizon of the scene.
- **Things:** `position: absolute; left: X%; top: Y%; transform: translate(-50%, -50%)`. Width/height = thing.size × vw. The thing's center is at the (X, Y) coordinate; the emoji is centered inside.
- **Bottom 💨 + 🏆 buttons:** `position: absolute; bottom: max(20px, env(safe-area-inset-bottom))`. Slight backdrop blur for legibility on busy scenes.
- **No top bar.** No nav. The kid's full attention is on the scene.

### 2.4 The tap interaction

**Default state:** each thing is a button. `onClick` plays a sound from its pool.

**Tap flow:**
1. Kid taps a thing.
2. The thing visually reacts (scale 1.0 → 1.3 → 1.0 over 280ms, ease-out).
3. A random sound from the thing's pool plays.
4. A reaction emoji (💨, 💥, 💦, ⭐) appears at the tap point, fades out over 600ms.
5. The "ui tap" sound plays at low volume (~30% of the thing's sound) so the kid gets tactile confirmation.
6. The 🏆 number increments by 1 (if the sound was a new one — the kid hasn't heard it before).

**No "Stop" button.** Sound auto-stops when the next tap happens, or when the sound ends, whichever comes first. The thing's tap doesn't play the new sound on top of the old one; it stops the old sound first.

**No "Random" button.** Each thing has its own pool; tap 5 times, you get 5 different sounds from that thing's pool. The 388-sound pool is the random, distributed across things.

### 2.5 The long-press / record interaction

**Trigger:** kid presses and holds a thing for ≥ 500ms.

**Flow:**
1. At 500ms, the thing visibly pulses red (scale 1.0 → 1.05 → 1.0, 200ms loop, with a red glow).
2. The mic permission prompt shows the FIRST time (browser-level). The kid can't dismiss this themselves; the operator has to tap "Allow."
3. After permission grant, recording starts. Max 3 seconds (auto-cut). The thing pulses red throughout.
4. The kid speaks/makes noise.
5. Recording ends when: the kid releases, OR 3 seconds elapse.
6. The thing now plays the kid's recording. The thing's color normalizes (back to scene colors).
7. The "ui success" chime plays.
8. A small "✨" particle appears at the thing's center, fades out 800ms.

**If mic permission is denied:** the thing shows a ⚠️ briefly, no recording happens, no sound plays. The kid can tap things normally; long-press just plays the next sound in the pool. The operator needs to enable mic permission at `/parent`.

### 2.6 The pin-drop interaction (new!)

**Trigger:** kid taps an empty area of the scene (not on a thing). The "empty area" is defined as any point where no thing is within 60px of the tap.

**Flow:**
1. The 💨 cloud appears at the tap point, gently bouncing. A speech bubble shows "Tap and hold to record" (or just the 🎤 icon, no text).
2. The kid taps and holds the new cloud → recording starts (same 3s cap, red pulse).
3. On release: the cloud becomes a real pin. It now plays the kid's recording.
4. The pin stays in the scene. If the kid reopens the app, the pin is still there.

**Tap on existing pin (kid's):** plays the kid's recording. Same visual reaction as default things.

**Long-press on existing pin:** re-record it. The kid can change their mind.

**Pile-up:** a kid can drop 10, 20, 50 pins in one scene. They stay. The scene gets crowded — that's the kid's creation.

### 2.7 The 💨 floating button

**Position:** bottom-left, 60px circle, gold (#fbbf24) with white 💨 emoji.

**Action:** tap it. Same as tapping an empty area — drops a new pin in the center of the scene. (Slight randomness: drops at 50% ± 5% so multiple taps don't all land in the exact same spot.)

**Visual:** subtle pulse every 3s when idle. "I'm here, kid."

### 2.8 The 🏆 number (bottom-right)

**Position:** bottom-right, small text "12" (the kid's total sounds heard). 14pt bold, white with 30% black scrim.

**Behavior:**
- Visible at full opacity.
- After 5 seconds of no interaction, fades to 30% opacity.
- On any tap, fades back to 100% (subtle attention to the count).
- Increments on every distinct sound heard. (Same sound heard twice = no increment.)
- Resets to 0 if operator hits "Reset progress" at `/parent`.

**Why this number:** gives the kid a sense of "I've heard a lot" without it being a leaderboard or a streak. It's a quiet badge of exploration. Most kids won't notice it; the ones who do will tap a few more things to see the number go up.

### 2.9 Scene transitions (swipe)

**Gesture:** horizontal swipe (left = next scene, right = previous). Threshold: 60px horizontal displacement, with no significant vertical motion.

**Animation:** the current scene slides out left (or right) over 280ms ease-out, the new scene slides in. Behind both, a transient 🏆 number is hidden.

**Audio transition:** a soft "whoosh" sound (the scene transition ui sound) plays during the swipe.

**Loop:** 4 scenes in a cycle. Swiping right from scene 1 goes to scene 4. Swiping left from scene 4 goes to scene 1. No end-stop.

### 2.10 The 4 scenes (hand-curated)

**Farm** — `id: farm`, bg: `/scenes/farm.jpg` (161 KB, generated v25w2). 12 things.

| # | emoji | name | x | y | size | sounds |
|---|-------|------|---|---|------|--------|
| 1 | 🐄 | Cow | 18 | 62 | 14 | `cow.mp3`, `extra/cow2.mp3`, `extra/cow_v3.mp3` |
| 2 | 🐖 | Pig | 33 | 66 | 12 | `pig.mp3`, `extra/pig2.mp3` |
| 3 | 🐎 | Horse | 50 | 60 | 14 | `horse.mp3`, `v1/horse.mp3`, `extra/horse2.mp3` |
| 4 | 🐑 | Sheep | 65 | 67 | 11 | `extra/sheep.mp3`, `extra/sheep_v2.mp3` |
| 5 | 🐐 | Goat | 82 | 64 | 11 | `extra/goat.mp3` |
| 6 | 🦆 | Duck | 22 | 82 | 10 | `duck.mp3`, `v1/duck.mp3` |
| 7 | 🐓 | Rooster | 75 | 22 | 11 | `rooster.mp3`, `v1/rooster.mp3` |
| 8 | 🚜 | Tractor | 88 | 78 | 12 | `extra/bull.mp3` (low engine rumbles) |
| 9 | 🚪 | Barn door | 8 | 52 | 11 | `extra/cat.mp3` (creak) |
| 10 | 🌾 | Hay bale | 50 | 80 | 9 | `extra/monkey_v2.mp3` (rustle) |
| 11 | 🐕 | Farm dog | 42 | 35 | 10 | `dog.mp3`, `extra/dog_v2.mp3` |
| 12 | 🦉 | Owl | 12 | 18 | 9 | `extra/owl.mp3` |

**Jungle** — bg: `/scenes/jungle.jpg` (336 KB). 12 things.

| # | emoji | name | x | y | size | sounds |
|---|-------|------|---|---|------|--------|
| 1 | 🐘 | Elephant | 22 | 60 | 16 | `elephant.mp3`, `extra/elephant2.mp3`, `extra/elephant_long.mp3` |
| 2 | 🦁 | Lion | 50 | 55 | 14 | `lion.mp3`, `extra/lion2.mp3`, `extra/lion_long.mp3` |
| 3 | 🐒 | Monkey | 35 | 32 | 11 | `monkey.mp3`, `extra/monkey_v2.mp3` |
| 4 | 🐍 | Snake | 75 | 65 | 10 | `snake.mp3`, `extra/snake2.mp3`, `extra/snake_long.mp3` |
| 5 | 🐸 | Frog | 14 | 85 | 10 | `frog.mp3`, `v1/frog.mp3` |
| 6 | 🦜 | Parrot | 80 | 14 | 10 | `bird.mp3` |
| 7 | 🌴 | Tree | 92 | 35 | 12 | `extra/sloth.mp3` (rustling) |
| 8 | 🦋 | Butterfly | 60 | 22 | 8 | `extra/raccoon.mp3` |
| 9 | 🌺 | Flower | 22 | 72 | 9 | `extra/cat2.mp3` (blooming) |
| 10 | 🐛 | Bug | 78 | 80 | 8 | `extra/bee_v2.mp3` (buzzing) |
| 11 | 🐆 | Leopard | 60 | 78 | 12 | `extra/dog_v3.mp3` (growl) |
| 12 | 🐊 | Crocodile | 8 | 50 | 13 | `extra/hippo.mp3` (snap) |

**Ocean** — bg: `/scenes/ocean.jpg` (139 KB). 12 things.

| # | emoji | name | x | y | size | sounds |
|---|-------|------|---|---|------|--------|
| 1 | 🐋 | Whale | 25 | 50 | 18 | `whale.mp3` (deep) |
| 2 | 🐬 | Dolphin | 55 | 38 | 12 | `extra/seal.mp3` (click) |
| 3 | 🦈 | Shark | 80 | 60 | 14 | `extra/dog.mp3` (bite) |
| 4 | 🐙 | Octopus | 38 | 68 | 11 | `extra/moose.mp3` (squelch) |
| 5 | 🦀 | Crab | 18 | 80 | 10 | `extra/skunk.mp3` (click) |
| 6 | 🐚 | Shell | 50 | 82 | 9 | `extra/cow_v3.mp3` (ocean) |
| 7 | 🐠 | Fish | 70 | 70 | 9 | `bird.mp3` (blub) |
| 8 | 🌊 | Wave | 8 | 65 | 14 | `extra/elephant_long.mp3` (crash) |
| 9 | ⛵ | Boat | 88 | 50 | 12 | `extra/horse2.mp3` (horn) |
| 10 | 🐳 | Splash | 28 | 35 | 11 | `frog.mp3` (splash) |
| 11 | 🦈 | Fin | 60 | 84 | 10 | `extra/snake2.mp3` (cut) |
| 12 | 🐬 | Jump | 45 | 30 | 11 | `extra/dog_v2.mp3` (splash) |

**Home** — bg: `/scenes/home.jpg` (~250 KB, to be generated v26a). 12 things. Prompt:

```
A bright, cheerful cartoon illustration of a cozy suburban home
interior for a kids' sound toy app. Wide horizontal banner,
1500x600 px. Cozy living room with a couch, a TV on a stand,
a coffee table, lamps, a window showing a garden, kitchen visible
in the background, a bathroom door slightly ajar. Pixar-style
art. Empty space in the center/foreground for 🚪, 🛋️, 📺, 💡
to overlay. No text. No logos.
```

| # | emoji | name | x | y | size | sounds |
|---|-------|------|---|---|------|--------|
| 1 | 🚪 | Door | 6 | 50 | 13 | `extra/cat.mp3` (knock) |
| 2 | 🛋️ | Couch | 28 | 65 | 14 | `extra/horse.mp3` (creak) |
| 3 | 📺 | TV | 50 | 45 | 13 | `extra/dog_v3.mp3` (click) |
| 4 | 💡 | Lamp | 75 | 30 | 11 | `extra/cat2.mp3` (click) |
| 5 | 🚿 | Shower | 18 | 22 | 10 | `extra/hippo.mp3` (water) |
| 6 | 🍳 | Pan | 70 | 65 | 11 | `extra/monkey_v2.mp3` (sizzle) |
| 7 | ☕ | Kettle | 82 | 68 | 9 | `extra/bear2.mp3` (whistle) |
| 8 | 📞 | Phone | 88 | 78 | 10 | `extra/owl.mp3` (ring) |
| 9 | ⏰ | Clock | 14 | 30 | 10 | `extra/dog_v2.mp3` (tick) |
| 10 | 🪟 | Window | 50 | 25 | 11 | `extra/moose.mp3` (knock) |
| 11 | 🚽 | Toilet | 92 | 80 | 9 | `extra/cow_v3.mp3` (flush) |
| 12 | 🛁 | Tub | 8 | 75 | 10 | `extra/cow2.mp3` (gurgle) |

**Total scenes:** 4. **Total things:** 48. **Total sound slots:** ~96-144 (each thing has 1-3 sounds). 388-sound pool covers all of them.

### 2.11 Idle / subtle motion (ambient liveness)

To make the scene feel alive, NOT interactive (no kid taps here, just visual):

- **Cow:** tail swishes left-right every 4-7s (rotate ±10°, 600ms)
- **Bird (parrot):** gentle bob up-down every 3s (translateY ±5px, 800ms)
- **Tree:** nothing (static)
- **Wave:** continuous slow drift (translateX ±3px, 4s loop, ease-in-out)
- **Cloud:** slow horizontal drift (translateX 0→15px, 8s, then reset)
- **Sun:** nothing (static)
- **Tractor:** nothing (static — too noisy if it "moved")
- **Door:** slight sway every 8-12s (rotate ±2°, 300ms) — like wind

**Implementation:** CSS keyframes + per-thing random delays. 0.3s variance per thing so they don't sync. Very subtle — `transform: translateX/Y` or `rotate` at ±5-10°. Disabled if `prefers-reduced-motion`.

### 2.12 Empty state (no scenes, no sounds)

This shouldn't happen (we always have scenes), but for safety:

- 💨 mascot in the center, sleeping (zzz emoji)
- Text: "Loading the party..." (one line, centered, 18pt, bold, cream color)
- Subtle pulse on the 💨 every 2s

### 2.13 Reduced motion (accessibility)

If the user has `prefers-reduced-motion: reduce`:
- Disable all idle animations (clouds don't drift, etc.)
- Disable the scale-bounce on tap (instant visual feedback instead: brief opacity flash 1.0 → 0.6 → 1.0 over 150ms)
- Disable the reaction emoji burst (no 💨/💥 flying out)
- Keep sound playback, scene transitions, and recording intact

### 2.14 The full state machine for a thing

Each thing has these states (visual only, sound is independent):

| State | Trigger | Visual |
|---|---|---|
| **idle** | default | emoji at scale 1.0, normal color, optional idle motion |
| **tap-react** | tap or short-press, 280ms | scale 1.0 → 1.3 → 1.0, ease-out |
| **recording** | long-press 500ms+, while held | red glow, scale 1.0 → 1.05 → 1.0 loop, 200ms |
| **recorded** | release after recording, 800ms | small "✨" particle, then return to idle |

States are not blocking; the kid can tap during a tap-react and it just resets.

---

## 3. Operator surface — `/parent`

### 3.1 The principle

**Hidden URL. No link from the kid app.** Operators (parents) type `/parent` or have it bookmarked. The two surfaces never reference each other.

The operator surface is for grown-ups. It has **chrome** — tab bars, settings forms, data tables. That's fine. Parents can read.

### 3.2 The operator dashboard layout

```
┌─────────────────────────────────────────────────────────┐
│  💨 Poot Party                              👤 Lily   │ ← header
│  Operator dashboard                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 🎤          │  │ 🌙          │  │ 👤          │  │
│  │ My kid's    │  │ Quiet hours │  │ Profiles     │  │
│  │ recordings  │  │ 🌙 8pm-7am  │  │ Lily         │  │
│  │ 12 sounds   │  │ 30m daily   │  │ + Add profile│  │
│  │             │  │             │  │              │  │
│  │ [Open]      │  │ [Open]      │  │ [Open]       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 🎵          │  │ ⚙️          │                    │
│  │ Sound       │  │ About       │                    │
│  │ library     │  │ v26         │                    │
│  │ 388 sounds  │  │ Free tier   │                    │
│  │             │  │             │                    │
│  │ [Open]      │  │ [Open]      │                    │
│  └──────────────┘  └──────────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- 5 cards in 2×3 grid (3 on top, 2 on bottom — leaves room for a "stats" line or future 6th card).
- Each card: emoji (40px), title (16pt bold), preview line (14pt regular, max 1 line), "Open" button (subtle, bottom-right of card).
- Tap a card to open that section as a sheet/overlay.

### 3.3 My kid's recordings

```
┌─────────────────────────────────────────────────────────┐
│  ← Back        🎤 My kid's recordings                    │
│                                                         │
│  12 recordings · 28 seconds total                        │
│                                                         │
│  Today                                                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🐄 Cow — 2.3s    12:34 PM    [▶] [⤓] [🗑]          ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ 💨 Pin 1 — 1.8s  12:32 PM    [▶] [⤓] [🗑]          ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  Yesterday                                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🐖 Pig — 4.1s   8:15 PM     [▶] [⤓] [🗑]          ││
│  └─────────────────────────────────────────────────────┘│
│  ...                                                     │
│                                                         │
│  [⤓ Download all as .zip]   [🗑 Delete all]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Recordings grouped by day, newest first.
- Each row: emoji (the thing the recording replaced, or 💨 for a new pin), name, duration, time, [▶] play inline, [⤓] download MP3, [🗑] delete (with confirm).
- "Download all as .zip" — exports every recording as MP3 in a zip. Parents can back up.
- "Delete all" — nuclear. Confirms with "Type DELETE to confirm."

### 3.4 Quiet hours

```
┌─────────────────────────────────────────────────────────┐
│  ← Back        🌙 Quiet hours                          │
│                                                         │
│  Quiet hours              [ON ●─────]                    │
│                                                         │
│  Start time             [8:00 PM ▾]                     │
│  End time               [7:00 AM ▾]                     │
│                                                         │
│  Daily limit             [30 minutes ▾]                  │
│  (kid plays a soft "shh" sound when limit reached)      │
│                                                         │
│  ──────────────                                          │
│  💡 Tips:                                                │
│  · Quiet hours are kid-device-time                      │
│  · Daily limit resets at midnight                       │
│  · Limits apply per profile                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Toggles and time pickers. Standard form.
- Tooltip on "Daily limit": "When reached, the app shows a 'Time for a break!' message and stops responding to taps for 1 hour." Soft, not punitive.

### 3.5 Profiles

```
┌─────────────────────────────────────────────────────────┐
│  ← Back        👤 Profiles                              │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ 🦒         │  │ 🐯         │  │ +          │        │
│  │ Lily       │  │ Sam        │  │ Add profile│        │
│  │ 28 sounds  │  │ 4 sounds   │  │            │        │
│  │ [Active]   │  │            │  │ (Premium)  │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│                                                         │
│  Free: 1 profile. Premium ($14.99/yr): up to 3.        │
│  [Upgrade]                                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Each profile: emoji (kid picks from a list), name, count of sounds heard.
- Tap to make active.
- Add profile: emoji picker (12-20 kid-friendly emojis: 🦒, 🐯, 🦁, 🐰, 🐶, 🦄, etc.) + name input.
- "Add profile" button is locked 🔒 in free tier, with a "Premium" badge.

### 3.6 Sound library

```
┌─────────────────────────────────────────────────────────┐
│  ← Back        🎵 Sound library                        │
│                                                         │
│  388 sounds · 12 hidden · 0 featured                   │
│                                                         │
│  Filter:  [All] [Animal] [Wet] [Dry] [Echo] ... [Hidden]│
│                                                         │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                    │
│  │🐄│ │🐖│ │🐎│ │🐑│ │🐐│ │🦆│ │🐓│                    │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                    │
│  Cow  Pig  Horse Sheep Goat Duck Roost                 │
│  3    2    2    2    1    2    2                      │
│  (sounds used per thing)                                │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 💨 cow-v3 (animal)  [▶] [Hide] [Feature]          │   │
│  │    3s · /sounds/extra/cow_v3.mp3                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ... (full list, scrollable)                            │
│                                                         │
│  [⤓ Download all]  [Show hidden only]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Top: 12 thing-cards (one per current "thing" across all scenes). Tap one to see its sounds.
- Below: list of all sounds in that thing, with [▶] preview, [Hide] (won't appear in defaults), [Feature] (force-include in kid's rotation — Premium).
- Filter chips: All / Animal / Wet / Dry / Echo / Long / Squeaky / Bubbly / Other / Hidden.
- Sound list: filename, duration, source path, [▶] preview, [Hide]/[Show], [Feature] (Premium only).

### 3.7 About / Settings

```
┌─────────────────────────────────────────────────────────┐
│  ← Back        ⚙️ About                                 │
│                                                         │
│  💨 Poot Party                                          │
│  v26 · Free tier                                        │
│  "Make your own animal noises."                          │
│                                                         │
│  [Upgrade to Premium $14.99/yr]                        │
│                                                         │
│  ──────────────                                          │
│                                                         │
│  Reset progress  [Reset]                                │
│  (deletes all kid's recordings, heard sounds, pins)      │
│                                                         │
│  Send feedback      [Email]                              │
│                                                         │
│  Privacy              [Open]                            │
│  (no data leaves the device)                             │
│                                                         │
│  Open source          [GitHub]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.8 Premium upgrade flow

**When:** the parent taps [Upgrade to Premium] anywhere.

**Where:** a Stripe Checkout opens in a new tab. We use Lemon Squeezy for indie-friendly checkout (or Stripe Checkout if we have a Stripe account). For v26, the Stripe webhook is mocked; real billing is v27.

**What premium unlocks:**
- 3 kid profiles (free: 1)
- Per-profile daily limit
- Custom sound upload (parent can drop in their own MP3)
- FX customization per scene
- "Featured" sounds (force-include in kid's rotation)
- Priority support (no SLA, just "we'll respond faster")

**How the operator knows it's premium:**
- The locked features show 🔒 icons with "Premium" badges
- After upgrading, the page reloads, locks disappear

### 3.9 Premium pricing

- **$1.99/month** or **$14.99/year** (save 37% with annual)
- **Free for the first 14 days** after creating the first profile (auto-upgrade prompt, not forced)
- **Cancel anytime** from the Stripe dashboard (we don't build a billing portal; Stripe does)

---

## 4. Information architecture

### 4.1 URLs

| URL | Surface | Auth |
|-----|---------|------|
| `/` | Kid's app | None |
| `/parent` | Operator dashboard | None (localStorage profile) |
| `/parent/recordings` | Recordings list | None |
| `/parent/quiet` | Quiet hours settings | None |
| `/parent/profiles` | Profile manager | None |
| `/parent/library` | Sound library | None |
| `/parent/about` | About / settings | None |
| `/api/stripe-webhook` | Stripe callback (v27) | Stripe signature |

### 4.2 Data storage (v26, local-first)

| Data | Where | Persistence |
|------|-------|-------------|
| 388 default sounds | `public/sounds/`, served by SW | Forever (precached) |
| 4 scene illustrations | `public/scenes/`, served by SW | Forever (precached) |
| Kid's recordings (audio blobs) | IndexedDB | Forever (or until parent deletes) |
| Kid's pins (recordings attached to scene positions) | IndexedDB | Forever |
| Heard-sounds count | localStorage | Forever (or until reset) |
| Active profile ID | localStorage | Forever |
| Quiet hours / daily limit | localStorage | Forever |
| Premium flag | localStorage (mocked in v26) | Forever |

**No server in v26.** v27 adds Stripe webhook.

### 4.3 Component hierarchy (v26)

```
<HashRouter>  (or pathname-based routing)
  <Routes>
    <Route path="/parent/*" element={<ParentApp />} />
    <Route path="/" element={<KidApp />} />
  </Routes>

<KidApp>
  <KidScreen />  // single full-screen scene
</KidApp>

<ParentApp>
  <ParentShell>  // 2x3 card grid on dashboard, full-screen views for sub-pages
    {activeSection === "dashboard" && <DashboardCards />}
    {activeSection === "recordings" && <RecordingsList />}
    {activeSection === "quiet" && <QuietHours />}
    {activeSection === "profiles" && <ProfilesList />}
    {activeSection === "library" && <SoundLibrary />}
    {activeSection === "about" && <AboutPanel />}
  </ParentShell>
</ParentApp>
```

### 4.4 File structure

```
src/
  App.tsx                       # Routes / vs /parent
  main.tsx                      # Entry, service worker registration
  index.css                     # Tailwind + custom CSS

  kid/                           # THE KID'S APP
    KidScreen.tsx                # Single full-screen scene + things
    SceneBackground.tsx          # Illustrated scene + scrim
    ThingTile.tsx                # The interactive thing
    FloatingAddButton.tsx        # 💨 button to drop new pin
    HeardCountBadge.tsx          # 🏆 bottom-right
    reactions.ts                 # Tap-react, record-pulse, ✨ particles
    useSoundEngine.ts            # play sound, queue, multi-sound per tap
    useRecording.ts              # MediaRecorder, IndexedDB
    useKidStorage.ts             # IndexedDB: recordings + pins + counts
    things.ts                    # Hand-curated things per scene
    scenes.ts                    # Scene defs (id, name, bg, things)

  parent/                        # /parent
    ParentApp.tsx                # Shell with route
    ParentShell.tsx              # 2x3 card grid layout
    DashboardCards.tsx
    RecordingsList.tsx
    QuietHours.tsx
    ProfilesList.tsx
    SoundLibrary.tsx
    AboutPanel.tsx
    PremiumGate.tsx              # 🔒 icon + upgrade CTA

  audio/
    engine.ts                   # playSound, stopAllSounds, FX, recording

  data/
    things.ts                   # Hand-curated things per scene
    scenes.ts                   # Scene defs
    soundPool.ts                # 388 sound paths (generated)
```

---

## 5. The recording system (deep detail)

### 5.1 Flow

1. Kid long-presses a thing OR taps 💨 + empty area.
2. **Mic permission check:** if not granted, browser shows prompt. (If denied, see §5.4.)
3. **Recording starts.** Max 3 seconds. Audio format: WebM with Opus codec (`audio/webm;codecs=opus`).
4. **Recording ends** when: kid releases, OR 3s elapses, OR kid navigates away.
5. **Blob is stored** in IndexedDB under key `pin:<sceneId>:<thingId>` or `pin:<sceneId>:<uuid>` (for new pins).
6. **The thing/pin plays back the new recording** the next time it's tapped.
7. **The original default sound pool is still there** as fallbacks. The kid's recording becomes the PRIMARY; defaults are backups.

### 5.2 Storage shape (IndexedDB)

Database: `poot-party` (version 1)
Object stores:
- `recordings`: `{ id: string, sceneId: string, thingId: string | null, blob: Blob, duration: number, createdAt: number }`
- `pins`: `{ id: string, sceneId: string, x: number, y: number, emoji: string, recordingId: string, createdAt: number }`
- `progress`: `{ profileId: string, heardSounds: string[] }` (list of sound keys heard)

The kid's recordings are linked to pins, but separately stored (so a pin can be deleted without losing the audio, and the audio can be exported independently).

### 5.3 Mic permission states

| State | Behavior |
|---|---|
| **Not yet asked** | Browser prompt on first long-press. After that, all subsequent recordings work. |
| **Granted** | Recording works normally. |
| **Denied** | Long-press shows a small "🎤" with a ⚠️ next to the thing, briefly. No recording. Taps still play sounds. Operator can re-request permission at `/parent`. |
| **Dismissed (X'd out)** | Same as denied. Treated as denial. |

### 5.4 iOS Safari specifics

iOS Safari is the worst case for MediaRecorder:
- WebM is supported in iOS 14.3+ on Safari. Earlier versions need fallback.
- `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')` returns true on modern iOS. False on older.
- **Fallback strategy:** if WebM is not supported, try `audio/mp4;codecs=mp4a.40.2` (AAC in MP4). iOS Safari supports this.
- Test on a real iOS device. If neither codec works, record button shows "🎤 not supported on this browser."

### 5.5 Playback

- Stored Blob is converted to a URL via `URL.createObjectURL(blob)` when the thing is tapped.
- The URL is revoked when the thing unmounts (cleanup).
- If the kid's recording is on the thing, it's played first. The default sounds in the pool are still there but the kid's recording takes precedence.

### 5.6 Per-profile isolation

Each profile has its own IndexedDB records. When the parent switches profiles, the kid's app shows that profile's recordings and pins. Profiles are independent.

**Implementation:** the recordings store has `profileId` field. Pins have `profileId`. When loading, filter by `profileId === activeProfileId`.

---

## 6. The "addictive" loop — concrete UX

### 6.1 The 5-second loop

**Tap a thing → sound + visual reaction.** This is the core interaction. Every tap is a tiny surprise because of multi-sound pools.

To make the surprise land:
- **Visual reaction is NOT generic.** Each thing has its own reaction. A cow wiggles. A bird flaps. A tractor shakes. (Subtle 200ms animations.)
- **Sound pool is varied.** Each thing has 2-4 different sounds. The kid never knows which they'll get.
- **🎉 "ui success" only on recording.** Not on every tap. The tap is the loop, not the reward.

### 6.2 The 30-second loop

After 5+ taps on a thing, a small "discovery hint" appears:

```
🐄 — heard 3 of 4 sounds!
```

Fades in at 50% opacity, holds 1.5s, fades out. Positioned near the thing.

This is **inviting exploration**, not nagging. It doesn't say "tap more!" — it just says "there are more."

### 6.3 The 5-minute loop

When the kid has tapped all 12 things in a scene, a tiny ✨ burst appears in the center of the scene. Then a subtle text fades in: "🔄 You found them all! Tap again for more sounds." Positioned bottom-center, 14pt, white, 3s display, fade out.

This isn't a "level complete" celebration. It's a quiet acknowledgment: "you've explored. keep going."

### 6.4 The 1-day loop (returning user)

- App opens to last-seen scene.
- Kid's recordings + pins are still there.
- 🏆 count shows "12 today" (resets at midnight — or just shows total heard all-time, simpler).
- No "Welcome back!" message. No "your daily goal" nonsense. The app is a tool, not a relationship.

### 6.5 What we explicitly DO NOT do

- ❌ No "daily login" streaks
- ❌ No "limited time" events
- ❌ No "you're 1 tap away from a reward!" notifications
- ❌ No "X friends are playing!" social pressure
- ❌ No real-money purchases to advance
- ❌ No Loot boxes / randomized rewards
- ❌ No "share with friends to unlock" mechanics
- ❌ No parental nagging ("Time's up! Subscribe to extend!")

These are predatory. Kids' apps should not have them. A sound toy is a tool, not an engagement machine.

---

## 7. Operator onboarding (first-time `/parent`)

The first time the parent hits `/parent`, show a 3-step onboarding:

### Step 1: Mic permission
"We need microphone access so your kid can record their own sounds. Tap Allow when prompted."

### Step 2: Profile setup
"What's your kid's name? Pick an emoji avatar."

### Step 3: Quick tour
"5 things to know: [Recordings] [Quiet hours] [Profiles] [Library] [About]. All optional, all yours."

Each step is dismissible. Total time: < 1 minute.

---

## 8. Accessibility

### 8.1 Kid screen
- All tap targets ≥ 60px × 60px (WCAG 2.5.5 target size, AAA)
- Things are absolutely positioned; if any overlap, increase the y% spacing
- Color contrast for the kid's labels: white text on 30% black scrim → ratio ≥ 7:1 (AAA for normal text)
- `prefers-reduced-motion` respected (see §2.13)
- `aria-label` on every interactive thing ("Cow, tap to hear a sound, hold to record")
- Screen reader support: the scene is `role="img" aria-label="Farm scene. 12 things to tap."` and each thing is `role="button" aria-label="..."`
- No timeouts on the kid's screen (kid might take time)
- Sound doesn't auto-play on app open (the kid taps to play)

### 8.2 Operator screen
- Standard form accessibility (labels, focus rings, keyboard nav)
- Operator dashboard at 16pt minimum (parents might be reading glasses-distance)
- Color contrast ≥ 4.5:1
- Skip-links: "Skip to recordings" / "Skip to library" for keyboard users

---

## 9. Performance budget

- **Bundle size:** 150KB target (down from current 245KB).
- **Initial load:** < 2s on a phone (over 4G).
- **Scene transition:** < 100ms swipe-to-render.
- **Tap-to-sound:** < 200ms (the kid's finger taps the screen, the sound plays).
- **Recording-to-playback:** < 500ms (kid records, hears their sound back).

### Bundle breakdown (target)

| Item | Size |
|------|------|
| JS (kid app + parent app) | ~80KB |
| CSS (Tailwind purged) | ~15KB |
| Service worker | ~5KB |
| 4 scene JPEGs (precached) | ~900KB |
| Default sounds (precached on first tap, runtime cache) | ~3MB |
| **Total initial load** | ~1MB |
| **After 1st session** | ~4MB |

---

## 10. Build order (v26a → v26c)

### v26a — Brand + structure + minimal kid screen

**Commits:**
1. Update `index.html` title, meta tags, manifest with Poot Party branding
2. Create new `src/kid/` directory with `KidScreen.tsx`, `SceneBackground.tsx`, `ThingTile.tsx`
3. Create `src/data/things.ts` with hand-curated Farm scene (12 things)
4. Create `src/data/scenes.ts` with 1 scene (Farm, fallback to CSS gradient)
5. Update `App.tsx` to use new KidScreen
6. Delete old `src/pages/SoundsPage.tsx`, `src/scenes.tsx` (replaced)
7. Update SW cache to v26
8. Deploy as v26a

**What works in v26a:**
- App opens to Farm scene (gradient fallback if scene JPEG not loaded)
- 12 things positioned and tappable
- Tap = play random sound from thing's pool
- Auto-stop-on-tap
- No recording yet, no operator surface yet
- No second scene yet (just Farm)

### v26b — Recording + pins

**Commits:**
1. `useRecording.ts` — MediaRecorder + IndexedDB
2. `useKidStorage.ts` — IndexedDB queries
3. Long-press on thing = start recording, red pulse, 3s cap
4. `FloatingAddButton.tsx` — tap to drop new pin in scene
5. `HeardCountBadge.tsx` — 🏆 bottom-right
6. Pin persistence (new pin = record + place, pin stays across reloads)
7. iOS Safari fallback (mp4 if WebM not supported)
8. Deploy as v26b

**What works in v26b:**
- Tap thing = play sound (default or kid's recording)
- Long-press thing = record new sound
- Tap empty area = drop a new pin (record its sound)
- Pin stays across page reloads
- 🏆 heard count visible

### v26c — 4 scenes + operator surface /parent

**Commits:**
1. Generate Home scene illustration (`node scripts/generate-scenes.mjs --scene=home`)
2. Hand-curate Jungle, Ocean, Home things
3. Horizontal swipe between scenes (touch handlers)
4. `/parent` route with 2x3 card grid
5. Recordings list page
6. Quiet hours settings
7. Profiles manager
8. Sound library browser
9. Premium upgrade UI (mocked, no real Stripe in v26)
10. Delete old code: cluster catalog, 3 catalog files, MySounds/Explore/Profile pages
11. Deploy as v26

---

## 11. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| iOS Safari WebM recording breaks | Fallback to MP4/AAC. Tested in v26b. |
| IndexedDB quota on devices | Recordings are short (3s, ~10KB each). Default quota is 50MB+ on most browsers. 1000 recordings = 10MB. |
| Mic permission denied on first long-press | Show ⚠️ briefly, don't record, keep playing defaults. Operator re-enables at /parent. |
| Kid drops 50 pins in one scene, scene gets crowded | That's the kid's choice. No hard cap. Soft suggestion after 20: "Lots of pins! Want to keep going?" |
| Premium upgrades mock in v26 | Show "Coming soon" UI. Real Stripe is v27. |
| Generate Home scene image | Use minimax image-01 with the same prompt pattern as Farm/Jungle/Ocean. ~30s. |
| Build breaks on the way (state management complexity) | Build v26a in 1 commit, get kid's screen working, then v26b adds recording incrementally. |

---

## 12. Success metrics

**For v26a (kid screen only):**
- Bundle size ≤ 200KB
- Tap-to-sound latency ≤ 200ms
- 12 things render on the Farm scene
- No console errors
- Vision check: "is this a kids' sound toy?" → yes

**For v26b (+ recording):**
- Long-press records audio
- Recording plays back on next tap
- Pin drop works
- Recordings persist across page reloads
- iOS Safari compatible

**For v26c (+ 4 scenes + /parent):**
- 4 scenes swipeable
- 48 things total
- /parent dashboard works
- Recordings list works
- Sound library browser works

**For v27 (+ real Stripe + premium):**
- $1.99/mo or $14.99/yr checkout flow
- Webhook updates premium flag
- Locked features unlock

---

## 13. What I'm NOT building in v26

These are real ideas for v27+:
- Social features (share recordings, follow other kids, public gallery) — needs a server, moderation, COPPA
- Multi-language support — current app is English-only; i18n is v28
- "Poot Party Daily" — featured scene of the day
- Custom sound upload (parent drops in MP3) — premium feature, needs UI
- AI sound generation (kid describes a sound, model generates) — needs API integration
- Cross-device sync (kid's recordings on iPad show on iPhone) — needs server
- Voice pitch shift (kid's recording played back at different pitches) — needs Web Audio
- "Poot Party TV" — auto-play mode that cycles through all scenes

These are all viable but not in v26.

---

## 14. Open questions for Cam before I start coding

1. **Brand confirmation:** "Poot Party" — green light, or different name?
2. **Mascot style:** the smiling 💨 cloud (eyes + smile) — does that work, or different mascot?
3. **Color palette:** gold + sky blue + cream — green light, or different?
4. **Recording cap:** 3 seconds. Is that right? (Longer = more memory per recording, more awkward for kids. Shorter = less expressive.)
5. **Scene count:** 4 (Farm, Jungle, Ocean, Home) — enough, or more?
6. **Default free tier:** 1 kid profile, 30-min daily limit, all 4 scenes, all 388 sounds — the limits? Or no limits?
7. **Premium pricing:** $1.99/mo or $14.99/yr — those numbers, or different?
8. **When to start coding:** now, or after another round of review on this doc?

I'll wait for your answers before writing any code. Let me know what you'd like to change.
