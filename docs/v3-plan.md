# PootBox v3.0 — Complete Product Plan

**Author:** Maya (Product Manager)  
**Date:** 2026-06-10  
**Status:** For Cam's review  
**Version:** 1.0 (initial plan, ready for implementation)

---

## 1. Product Positioning

PootBox v3.0 is a sensory sound toy for children aged 3–7, living at the intersection of Sago Mini Sound Box's quiet confidence, Toca Boca's soft physicality, and Pok Pok Playroom's "what happens if I...?" curiosity. It is not a game — there are no goals, no scores, no win states. It is a place. The child enters, finds familiar animal sounds, discovers they can make their own, and stays because it feels good in their hands. The app exists because the best toys don't tell you what to do with them. PootBox v3.0 is the sound toy you hand a kid at a restaurant and get back 20 minutes later, still engaged.

---

## 2. The Kid's First 60 Seconds

The app opens. Cream background. Nothing else. No title card, no instructions, no "tap a circle!" banner. Just4–6 soft emoji-bubbles floating in slow, gentle drift — like leaves on water. They bob and bump each other silently. A3-year-old's face goes to the screen within2 seconds.

**Second 0–5:** They look. The bubbles are moving. They reach for one.

**Second 5–10:** They tap a bubble. It springs to 1.15× scale and back (200ms spring), a sound plays, a ripple expands outward. They do it again. Maybe a different bubble. Another sound. They are already in the core loop.

**Second 10–20:** If they tap rapidly (2+ taps in 800ms), the combo counter begins. At ×5, a subtle gold tint sweeps the canvas. At ×10, a burst of small stars erupts from the tap point. They did not ask for this. They do not need to know it exists. It rewards them for doing what came naturally.

**Second 20–40:** They discover the ＋ button. It is top-right, small, soft cream pill. Not intimidating. They tap it. The menu slides up. They see "Library" and "Record." They tap "Library." They see 12 familiar emojis. They tap the 🐄 cow. It pops onto the canvas with a tiny landing animation. They have now extended the toy.

**Second 40–60:** They tap the new cow. It plays their own voice (or the cow sound). They grin. They might tap＋ again, go to "Record," and record their own sound. They are a creator now.

The entire60-second arc: open → tap → discover + → add from library → record → creator. No reading. No help. No adult in the room required.

---

## 3. Core Loop

**The rhythm:** Tap a bubble → spring bounce + sound + ripple → pause for the sound to finish (800ms–2s) → the bubble has drifted a little → tap again, slightly different position → another sound.

**What makes them want to do it again:** The drift. Every tap has a consequence — the bubble moves, bumps a neighbor, settles in a new spot. The field is never exactly the same twice. Pok Pok Playroom works because everything is a sandbox with no wrong answers. PootBox v3.0 works because every tap changes the world a little, and the world is calm and pleasant. There is no goal. There is only "what happens if I tap this one?" and the answer is always a sound and a small visual reward.

**The single-voice policy** is load-bearing here. One sound at a time means every sound matters. Overlapping audio would make it chaotic; single-voice makes it deliberate and playful.

**The combo system** (keep from v2.0) is the only "score." It is invisible to the child until ×5, when they notice a gold glow. At ×10, stars. It rewards curiosity without making it a game.

---

## 4. The Canvas

### 4a. Layout Algorithm

The canvas is a 16:9 play area (full viewport minus safe areas). Emojis are placed using **seeded random with no-overlap rejection**:

1. Generate a random position (x, y) within the safe bounds (padding: 60px top, 80px bottom, 20px left/right).
2. Check distance to all previously-placed emojis. Minimum separation = sum of both radii + 16px gap.
3. If overlap: retry with a new random position (up to 50 attempts), then use force-directed relaxation pass (10 iterations of pushing overlapping circles apart along their collision normal).
4. Place the emoji. Apply a tiny random initial velocity (magnitude 0.1–0.3 px/frame, random direction).

**Gravity-like drift:** Each bubble has a velocity vector. Every frame, apply: `vel.y += GRAVITY * dt` (GRAVITY = 0.015 px/frame²). Apply friction `vel *= FRICTION` (FRICTION = 0.998). The result is a slow, constant downward pull that is barely perceptible — likeobjects in water, not falling. The field "breathes."

**Page-load placement:** When a page loads, run the placement algorithm once to assign initial positions. Then the physics loop takes over. This means every page load looks slightly different even with the same set of emojis.

### 4b. Bubble Visual Spec

Each bubble is a **soft white circle with a subtle gradient and drop shadow**. The emoji lives inside, centered, at55% of the bubble diameter.

```
Size: 64px diameter (default). Range: 56px–72px depending on emoji density.
Shape: circle, border-radius: 50%
Background: radial gradient from white (#FFFFFF) at center to #F5F0E8 at edge
Border: 1.5px solid rgba(255,255,255,0.6)
Shadow: 0 4px 16px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)
Emoji: centered, font-size: 32px (for64px bubble), no text-shadow
Depth/parallax: bubbles further from center are slightly more transparent (opacity 0.92 vs 1.0 at center) — subtle, not required
```

The bubble is NOT a colored circle. The v2.0 colored circles are gone. The bubble is a soft, slightly warm white — like a soap bubble or a frosted glass orb. Sago Mini aesthetic: no hard edges, no saturated colors, no visual noise.

### 4c. Drift Behavior

- **Per-bubble velocity:** Each bubble stores `{ x: velX, y: velY }`. Initialized to small random values on page load.
- **Gravity:** `velY += 0.015` per frame. Bubbles slowly drift toward the bottom.
- **Wall bounce:** When bubble edge hits canvas boundary, reflect velocity with `WALL_BOUNCE = 0.65` damping. Bubble does NOT stop — it bounces gently.
- **Bubble-bubble collision:** When two bubbles overlap, push them apart along their collision normal (overlap / 2 each), then reflect their relative velocity with `COLLISION_BOUNCE = 0.75`. They bump and drift away.
- **Drift nudge:** Every 2.5 seconds, apply a small random impulse to each bubble (magnitude 0.2–0.5 px, random direction). This keeps the field alive even when untouched.
- **Reduced motion mode:** When `settings.reducedMotion = true`, zero out all velocities after each placement, set GRAVITY = 0, and skip the drift nudge. The field is completely static. Bubbles only move when dragged.

### 4d. Empty Space

| Emoji count | Canvas feel |
|---|---|
| 2 | Sparse, calm, meditative. Bubbles drift slowly, lots of open space. |
| 4 | Comfortable. Sago Mini "empty room" feel. Easy to find any bubble. |
| 6–7 | Optimal density. This is the default "current set." Full without being crowded. |
| 8 | Maximum. Still comfortable. Some bumping. The limit is respected. |
| 9–12 | Possible but visually dense. Triggered only when kid has added many recordings. Not the default experience. |

### 4e. Touch Response

The moment a finger touches a bubble:

1. **Scale spring:** `transform: scale(1.0)` → `scale(1.18)` over120ms (spring curve, slight overshoot to1.2 then settle to 1.18) → `scale(1.0)` over 100ms. This is a CSS animation with `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring-ish). No JS animation library needed.
2. **Sound plays:** The bubble's sound starts immediately (single-voice, interrupts any playing sound).
3. **Ripple expands:** A circular ripple (same color as bubble border, rgba(255,255,255,0.5)) expands from the tap point, growing from 0 to 80px diameter over 600ms, then fading out. This is a CSS animation on a positioned div.
4. **Combo system:** If this tap is within 800ms of the previous tap, increment combo counter. At ×5: gold canvas glow (subtle radial gradient from center, `#FFF8E7` at 20% opacity). At ×10: star burst (8 small star emojis drift outward from tap point, 600ms, then disappear).

### 4f. Drag

1. **Pointer down on bubble:** Bubble picks up. Scale to 1.1×. Shadow deepens (08px 24px rgba(0,0,0,0.15)). Other bubbles are not interactable (pointer-events: none on canvas siblings, but the dragged bubble keeps pointer capture).
2. **Drag:** Bubble follows finger with no lag. Other bubbles continue drifting in the physics loop.
3. **Release:** Bubble does NOT stay at the exact release point. Instead, it eases toward the release point with a small spring animation (200ms, same spring curve as tap). If the release point is outside canvas bounds, the bubble bounces off the wall and settles at the nearest valid position.
4. **Velocity on release:** The bubble inherits the drag velocity (calculated from last3 pointer-move events). Throwing it fast makes it fly across the canvas and bounce off walls.

---

## 5. The Add Menu

### 5a. The ＋ Icon

```
Size: 44px × 28px pill shape
Background: #F5F0E8 (warm cream, same as canvas background tone)
Border: 1.5px solid rgba(0,0,0,0.06)
Border-radius: 14px
Icon:＋,18px, color #92705A (warm brown, not stark white)
Font: system-ui, weight 600
Position: fixed, top-right, 16px from edges
Shadow: 0 2px 8px rgba(0,0,0,0.08)
Micro-animation on hover: scale(1.05), shadow deepens to 0 4px 12px rgba(0,0,0,0.12)
Disabled state (at 8 emojis): opacity 0.4, cursor not-allowed, no hover effect
```

The icon is NOT the current stark white 56px circle. It is a soft, warm, understated pill — like a Sago Mini UI element. It blends into the background until you need it.

### 5b. Open Animation

Menu appears with: `opacity: 0 → 1` + `translateY(8px) → translateY(0)` over 200ms, `ease-out`. The menu slides up from near the button. Background dims to `rgba(0,0,0,0.15)` with `backdrop-filter: blur(4px)`. No jarring full-screen takeover.

###5c. Menu Layout

```
Width: 320px (max),90vw on mobile
Max height: 70vh, scrollable
Border-radius: 20px
Background: white
Shadow: 0 8px 32px rgba(0,0,0,0.12)
Padding: 0
```

**Header:** Two tabs at top, "Library" | "Record", separated by a 1px #E8E0D5 line. Active tab: amber underline (#F59E0B, 2px, rounded). Inactive tab: warm gray text (#92705A).

**Close button:** × in top-right corner of the menu card, 40px tap target, color #92705A. Tap outside the menu card also closes it.

### 5d. Library Tab

Grid of4 columns. Each cell is 64px × 64px:

- **Built-in emoji cell:** Shows the emoji at 32px, centered. Tap → adds that emoji to the current page canvas. If the emoji is already on the canvas, tapping it removes it from the canvas (with the float-up-fade animation).
- **Recording cell:** Shows the kid's custom emoji (from recordings). Same behavior as built-in. If on canvas, shows a small cream checkmark badge in the bottom-right corner of the cell.
- **Cell tap feedback:** Scale 0.95 on press, 1.0 on release (100ms).

The grid shows all 12 built-in emojis first (in the order from constants.ts), then all custom recordings below, in reverse chronological order (newest first).

### 5e. Record Tab

3-state flow, same as v2.0 but cleaner:

**State 1 — Idle:** Large microphone button (64px circle, cream background, mic icon in warm brown). Label below: "Record a sound." Tap the button → State 2.

**State 2 — Recording:** The button becomes a red square (32px, rounded 8px) with a stop icon. Above it: a waveform visualization (simple bars that respond to MediaRecorder input levels). A timer counts up: "0:00 / 0:06." Tap the stop button → State 3.

**State 3 — Picking emoji:** The recorded sound plays automatically. A grid of 12 common emojis appears below (🐄🐕🐈🐖🦆🦁🐸🐒🐎🐘🐓🐻). Tap one to confirm, or "Cancel" to discard and return to State 1. The selected emoji becomes the recording's visual identity.

### 5f. Count Limit

Max 8 emojis on canvas. When at8:
- The ＋ button is visually disabled (opacity 0.4, no hover effect).
- Tapping the disabled button shows a small tooltip/pill below the button: "Move or remove an emoji first" in warm brown text on cream background. This disappears after 2 seconds or on any other interaction.
- The Library tab cells for emojis already on canvas show a checkmark — they are "already added" state, still tappable to remove.

---

## 6. The Pages System

### 6a. Pages Icon

Second icon, to the left of the ＋ button. A small stack of cards icon (two overlapping rounded rectangles, 16px × 12px each, offset by 4px). Same style as the ＋ button (cream pill, warm brown icon). Slightly smaller than ＋: 36px × 24px pill.

### 6b. Pages Popup

Tapping the pages icon opens a small popup (not a full menu — a compact card, 280px wide):

```
Shows: "Page 1 of 3" as a centered label
Below: a horizontal row of page dots (● ○ ○), tappable to switch
Each dot: 10px diameter, active dot is 12px and amber (#F59E0B)
"+ Add page" button at bottom: text button, warm brown, + icon
```

### 6c. Page Structure

Each page is a named (or rather, unnamed) canvas with its own set of emojis. Pages are ordered, sequential. The first page is the "home" page and cannot be deleted.

**Add page:** Tap "+ Add page" → creates a new empty page, switches to it immediately, closes the popup. If at 8 pages, the "+ Add page" button is hidden.

**Switch page:** Tap a dot → the current page slides out to the left, the new page slides in from the right (300ms ease-in-out). The physics loop continues seamlessly — bubbles keep drifting.

**Delete page:** Long-press (800ms) on a dot → a small confirmation appears below the dot: "Delete this page?" with "Delete" (red text) and "Cancel" buttons. If confirmed, the page is removed and the active index shifts to the previous page (or page 0 if at0). The first page cannot be deleted.

###6d. Persistence Schema

```typescript
// localStorage key: "pootbox-v3-pages"
interface PagesState {
  active: number;          // 0-indexed active page
  pages: Page[];           // ordered array, first page is always index 0
}

interface Page {
  id: string;              // "page-{timestamp}" for new pages
  circleIds: string[];     // IDs of circles on this page (built-in "cow" or recording "c-{timestamp}")
}

// Built-in circles have fixed IDs matching constants.ts: "cow", "dog", "cat", etc.
// Recording circles have IDs: "c-{timestamp}" matching recordings.ts

// Initial state on first launch:
// { active: 0, pages: [{ id: "page-home", circleIds: ["cow", "dog", "cat", "pig", "duck", "lion"] }] }
// Default shows 6 emojis on the home page.
```

### 6e. Visual Indicator

A row of dots at the **bottom center** of the canvas, 24px from the bottom edge. One dot per page. Active dot:10px amber filled circle. Inactive dots: 6px warm-gray outlined circles. The dots are horizontally scrollable if there are 5+ pages (swipe to see more dots). Tap a dot to switch pages.

No "Page 1 of 3" text label by default — the dots are self-explanatory. The pages icon popup shows the full count when tapped.

---

## 7. The Complete State Model

### 7a. IndexedDB Schema (Recordings)

```
Database: "pootbox"
Version: 1
Store: "recordings"
  Key: string (recording ID, e.g. "c-1719000000000")
  Value: Blob (audio data, audio/webm or audio/mp4)
```

Metadata (emoji per recording) is stored in localStorage:
```
Key: "pootbox-recording-emojis"
Value: Record<string, string>  // { "c-1719000000000": "🐄", ... }
```

### 7b. localStorage Schema (Pages + Settings)

```
Key: "pootbox-v3-pages"
Value: PagesState (see section 6d)

Key: "pootbox-settings-v1"
Value: { volume: number, reducedMotion: boolean }  // existing, keep

Key: "pootbox-onboarded-v1"
Value: "1"  // existing, keep (for v3.0 onboarding state)
```

### 7c. Runtime State (React)

```typescript
// In PootBox.tsx (composition root):
interface RuntimeState {
  // Canvas geometry
  canvasSize: { w: number; h: number };       // from ResizeObserver

  // Pages
  pages: PagesState;                            // loaded from localStorage on mount
  setPages: (p: PagesState) => void;            // persists to localStorage on every change

  // Active page's circles (derived from pages state)
  activeCircleIds: string[];                    // pages.pages[pages.active].circleIds

  // All available circles (built-in + custom)
  builtInCircles: Circle[];                     // from constants.ts CIRCLES
  customCircles: CustomCircle[];                // loaded from IndexedDB on mount

  // Physics state (in Physics.ts, not React state)
  // Bubbles are managed in a ref-based array: PhysicsCircle[]
  // Updated every frame via requestAnimationFrame
  // React state: tick counter forces re-render of bubble positions

  // UI state
  showAddMenu: boolean;
  showPagesPopup: boolean;
  showSettings: boolean;
  pressedId: string | null;                     // which bubble is being pressed
  deleteTarget: string | null;                   // recording circle with delete X shown

  // Effects
  ripples: Ripple[];                            // array, spawned on tap, auto-removed after 700ms
  sparks: Spark[];                               // array, spawned on collision, auto-removed after 600ms
  comboCount: number;                            // rapid tap counter
  comboBurst: { x: number; y: number; n: number } | null;
  confettiBurst: number;                         // increments on every 10th tap

  // Recording
  recPhase: "idle" | "recording" | "picking";
  pendingBlob: Blob | null;
  pendingUrl: string | null;
  recordingMs: number;
  micPermState: "prompt" | "denied" | "granted" | "unsupported";
  micDenied: boolean;

  // Settings
  settings: Settings;
}
```

### 7d. Circle ID System

- **Built-in circles:** ID matches `constants.ts` CIRCLES entries: `"cow"`, `"dog"`, `"cat"`, `"pig"`, `"duck"`, `"lion"`, `"frog"`, `"monkey"`, `"horse"`, `"elephant"`, `"rooster"`, `"bear"`.
- **Recording circles:** ID format: `"c-{timestamp}"` where timestamp is `Date.now()` at the moment of recording creation. Example: `"c-1719000000000"`. This matches the v2.0 convention and recordings.ts schema.

---

## 8. Audio Architecture

**Single-voice policy (unchanged from v2.0):** When a new sound wants to play, stop ALL currently-playing sounds first, then start the new one. No two sounds overlap. This is enforced by `audioManager.ts`'s `playSingle()` function.

**No preloading.** When a page loads, no audio files are fetched. Audio loads lazily when the bubble is first tapped (the browser's default audio behavior). For recording blobs (`c-{timestamp}`), the blob URL is already in memory since it was created during recording — no additional load needed.

**Page switching and audio:** When switching pages, any currently-playing sound is stopped immediately (single-voice policy handles this). The new page's bubbles have no preloaded audio. Tapping a bubble on the new page loads and plays its sound normally.

**Rapid taps across pages:** If the kid rapidly taps bubbles on different pages (by switching pages quickly and tapping), each tap fires `playSingle()`. The single-voice policy means only the most recent tap's sound plays. No special handling needed.

**Recording blob URLs:** Created with `URL.createObjectURL(blob)` during recording. Revoked in `deleteCustomCircle()`. All blob URLs are kept in memory for the session (they're relatively small audio blobs). On page refresh, recordings are reloaded from IndexedDB and blob URLs are recreated.

---

## 9. Animations and Physics

### 9a. Bubble Drift

The physics loop runs in a `requestAnimationFrame` callback in `Physics.ts` (no React state inside the loop — only a React tick counter to trigger re-renders).

```typescript
// Physics.ts constants
GRAVITY: 0.015           // px/frame², gentle downward pull
FRICTION: 0.998 // per-frame velocity damping
WALL_BOUNCE: 0.65        // velocity reflection at canvas edges
COLLISION_BOUNCE: 0.75   // velocity reflection on bubble-bubble collision
DRIFT_NUDGE_INTERVAL: 2500  // ms between random drift nudges
DRIFT_NUDGE_MAGNITUDE: 0.3  // px/frame impulse magnitude
```

The loop is wrapped in a `try/catch` error boundary (per v2.0's pattern). If the loop errors, bubbles become static — the kid can still tap to play sounds.

###9b. Touch Response Animation

```css
/* Tap spring scale */
@keyframes bubble-tap {
0%   { transform: scale(1.0); }
  40%  { transform: scale(1.18); }
  100% { transform: scale(1.0); }
}
/* Duration: 220ms, ease-out spring curve via cubic-bezier(0.34, 1.56, 0.64, 1) */
```

### 9c. Add Emoji Animation

When an emoji is added from the Library tab:
1. A new bubble spawns at a random x position at the **top of the canvas** (y = -radius, just above the visible area).
2. It falls under gravity. The physics loop handles this naturally.
3. On the frame where it first enters the visible canvas area, a tiny "pop" sound plays (a short, soft200Hz sine wave burst,80ms, generated via Web Audio API — no file needed).
4. The bubble settles among the others.

### 9d. Remove Emoji Animation

When an emoji is removed (by tapping its Library tab cell while it's on canvas):
1. The bubble scales from 1.0 to 0 over 250ms (ease-in).
2. Simultaneously, it floats upward: y decreases by 40px over250ms.
3. Opacity fades from 1 to 0.
4. After250ms, the bubble is removed from the physics array and the page's circleIds list.

### 9e. Page Transitions

- **Exit:** Current page's bubbles slide left at their current drift velocity (no abrupt stop). Canvas opacity fades from 1 to 0.5 over 150ms.
- **Enter:** New page's bubbles slide in from the right. Canvas opacity fades from 0.5 to 1 over 150ms, offset by 150ms (so there's a 150ms crossfade).
- **Duration:** 300ms total. Timing function: `ease-in-out`.
- **Physics during transition:** The physics loop continues running. Bubbles drift during the transition, so the new page is already "alive" when fully visible.

### 9f. Combo System (Keep from v2.0)

The v2.0 combo system works. Keep it exactly as-is:
- Rapid taps (within 800ms) build a combo counter.
- At ×5: canvas gets a subtle gold radial glow (CSS, not a canvas draw — just a fixed `div` with `pointer-events: none` that fades in).
- At ×10: 8 small star emojis drift outward from the tap point, 600ms, then disappear.
- Confetti burst fires on every 10th cumulative tap (session counter, not per-circle).

The only change in v3.0: the combo glow and star burst animate over the canvas dots indicator too (the dots are children of the canvas, so they're covered by the glow div).

---

## 10. Settings (Still Hidden, Cleaner)

The settings modal is still hidden — it requires a 5-second hold on a blank area of the canvas (not on a bubble). Keep the existing pattern.

**Settings modal contents (cleaner design):**

1. **Volume slider** (0–100%): Label "Volume" with live percentage display. Same slider as v2.0, styled to match the warm cream/amber palette.
2. **Reduce motion toggle**: Same as v2.0. When ON: `GRAVITY = 0`, drift nudge disabled, all CSS animations replaced with instant state changes, page transitions are instant opacity fades (no slide).
3. **Reset all pages** button: Text button, red (#DC2626), with a confirmation modal: "Remove all pages and start fresh?" with "Cancel" (amber outline) and "Reset" (red fill). This clears `pootbox-v3-pages` and resets to the initial single-page state.
4. **About** link: "About PootBox" → opens `/privacy.html` in a new tab. No in-app web view — just a standard link.
5. **Shake to randomize** (keep from v2.0): Device motion shake handler applies random velocity impulses to all bubbles. Kept as-is.

The "5-second hold" mechanic: same as v2.0. Hold on any blank canvas area (not on a bubble) for 5000ms. The hold timer is cancelled if the finger moves more than 25px (to distinguish from scrolling/dragging).

---

## 11. Technical Architecture

###11a. File Structure

The current `PootBox.tsx` is 1,729 lines. v3.0 splits into focused, single-responsibility files. **Target: no single file > 400 lines.**

```
src/pootbox/
├── PootBox.tsx (~200 lines) — composition root, state assembly, layout
├── Bubble.tsx            (~150 lines)  — single bubble rendering + touch handlers
├── Canvas.tsx            (~250 lines)  — play area, physics loop host, ripple/spark rendering
├── AddMenu.tsx          (~300 lines)  — ＋ menu, Library tab, Record tab
├── PageBar.tsx          (~100 lines)  — dot indicator, pages popup
├── Settings.tsx         (~100 lines)  — settings modal (renamed from SettingsModal.tsx)
├── Physics.ts           (~150 lines)  — pure physics engine, no React, no DOM
├── pages.ts             (~80 lines)   — localStorage persistence for pages
├── Layout.ts            (~60 lines)   — random placement algorithm
├── audioManager.ts      (existing, keep as-is)
├── recordings.ts        (existing, keep as-is)
├── types.ts             (extend with Bubble, Page types)
└── constants.ts         (extend with physics tunables, layout params)
```

### 11b. New Types (types.ts additions)

```typescript
// Bubble instance (runtime, in physics loop)
export interface Bubble {
  id: string;
  emoji: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  mass: number;
  lastTouchedAt: number;
  lastReleasedAt: number;
  lastDriftedAt: number;
  isBuiltIn: boolean;
  sounds: string[];        // for built-in: from CIRCLES; for recordings: [blobUrl]
  color: string;          // "transparent" for all v3.0 bubbles
  shadow: string;         // "transparent"
}

// Page (persisted)
export interface Page {
  id: string;
  circleIds: string[];
}

// Pages state (localStorage)
export interface PagesState {
  active: number;
  pages: Page[];
}
```

### 11c. New Constants (constants.ts additions)

```typescript
// Canvas layout
export const CANVAS_PADDING_TOP = 60;
export const CANVAS_PADDING_BOTTOM = 80;
export const CANVAS_PADDING_HORIZONTAL = 20;
export const BUBBLE_MIN_GAP = 16;           // px, minimum separation between bubble edges
export const MAX_PLACEMENT_ATTEMPTS = 50;   // for the rejection sampler
export const RELAXATION_ITERATIONS = 10;    // force-directed relaxation passes

// Bubble sizes
export const BUBBLE_DIAMETER_DEFAULT = 64;
export const BUBBLE_DIAMETER_MIN = 56;
export const BUBBLE_DIAMETER_MAX = 72;
export const EMOJI_SIZE_RATIO = 0.5;        // emoji font-size = bubble_diameter × 0.5

// Physics tunables
export const GRAVITY = 0.015;
export const FRICTION = 0.998;
export const WALL_BOUNCE = 0.65;
export const COLLISION_BOUNCE = 0.75;
export const DRIFT_NUDGE_INTERVAL_MS = 2500;
export const DRIFT_NUDGE_MAGNITUDE = 0.3;

// Limits
export const MAX_CIRCLES_PER_PAGE = 8;
export const MAX_PAGES = 8;
export const COMBO_WINDOW_MS = 800;
export const PER_CIRCLE_SOUND_COOLDOWN_MS = 250;
```

### 11d. Estimated Line Counts (post-split)

| File | Lines | Notes |
|---|---|---|
| PootBox.tsx | ~200 | Composition root, all state, layout |
| Bubble.tsx | ~150 | Single bubble render + pointer events |
| Canvas.tsx | ~250 | Canvas div, physics loop, ripple/spark render |
| AddMenu.tsx | ~300 | Full menu with both tabs |
| PageBar.tsx | ~100 | Dot indicator + popup |
| Settings.tsx | ~100 | Settings modal, ~150 → ~100 with simplified design |
| Physics.ts | ~150 | Pure JS physics, no React, no DOM |
| pages.ts | ~80 | Load/save pages to localStorage |
| Layout.ts | ~60 | Seeded random placement |
| audioManager.ts | ~54 | Existing, unchanged |
| recordings.ts | ~100 | Existing, unchanged |
| types.ts | ~120 | Extended with Bubble, Page types |
| constants.ts | ~90 | Extended with physics + layout constants |
| **Total** | **~1,700** | Slightly more files, much better separation |

This is a net reduction in effective complexity: ~1,700 lines across 13 files means no file is hard to navigate, and each file has a single clear purpose.

---

## 12. Phased Delivery Plan

Ship in5 phases. Each phase is independently shippable and adds measurable value. Each phase: 1–2 days of focused work.

---

### Phase 1: "Calm by Default" — Drop the Grid

**Goal:** Replace the rigid 4×3 grid with a calm, floating, physics-driven canvas. The visual foundation of v3.0. No new features beyond the canvas change.

**What gets built:**
- `Physics.ts` — the pure drift engine (gravity, friction, wall bounce, bubble-bubble collision, drift nudge)
- `Layout.ts` — seeded random placement with no-overlap rejection
- `Bubble.tsx` — the new bubble visual spec (soft white circle, emoji centered, shadow)
- `Canvas.tsx` — the canvas div hosting the physics loop, rendering bubbles via absolute positioning
- Refactored `PootBox.tsx` — wires up the new canvas, removes the grid layout code
- Extend `types.ts` and `constants.ts` with new types and physics tunables

**What gets removed:**
- The4×3 grid layout logic (all `cols = 4; rows = 3` code gone)
- The colored circle backgrounds (all `color` fields now `"transparent"`)
- The hero circle pulse (replaced by the gentle drift — the hero concept is gone, all bubbles are equal)

**What stays the same:**
- The ＋ button still directly opens the recording flow (no menu yet)
- Single-page only (no pages system)
- All12 built-in emojis always present (no limit yet)
- Combo system, sparks, ripples — all unchanged

**Files added/changed:** 8 new files, ~1,200 lines new code  
**Bundle impact:** +12KB gzipped (Physics.ts + Layout.ts are small; Bubble.tsx replaces grid rendering code)  
**After Phase 1:** The app looks and feels completely different — calm floating bubbles, no grid, Sago Mini aesthetic. Still single-page, no menu.

---

### Phase 2: "Library Menu" — The＋ Menu

**Goal:** Replace the ＋ direct-recording-flow with a proper menu. The add flow that makes the kid a creator.

**What gets built:**
- `AddMenu.tsx` — the full ＋ menu with Library and Record tabs
- `PageBar.tsx` — the dot indicator (just the dots, no popup yet — the dots appear but tapping a bubble from the library is the only way to add/remove for now)
- Refactored `PootBox.tsx` — ＋ button now opens the menu
- Update `constants.ts` with `MAX_CIRCLES_PER_PAGE = 8`
- Update `types.ts` with `Page`, `PagesState`

**What gets removed:**
- The old＋ direct-to-recording-flow (the＋ button no longer long-presses to open recording — it opens the menu)
- The old＋ button long-press behavior (gone)

**What stays the same:**
- All 12 built-in emojis always available in the Library tab
- Recording flow (the Record tab) is the same 3-state flow as v2.0, just cleaner
- Single-page only (no pages system yet — dots are shown but the page system is not wired up)
- The 8-emoji limit is enforced on the Library tab (cells show checkmark when at limit)

**Files added/changed:** 3 new files, ~450 lines new code  
**Bundle impact:** +8KB gzipped (AddMenu.tsx is the largest new file)  
**After Phase 2:** The app is functionally complete for the core v3.0 experience. ＋ opens a menu, kid can add/remove emojis, record their own, limit is enforced. Pages system is visually present (dots) but not functional.

---

### Phase 3: "Pages" — The Page System

**Goal:** Make the dots functional. The kid can now have multiple pages of emojis, like a deck of slides.

**What gets built:**
- `pages.ts` — localStorage persistence layer for pages
- Full `PageBar.tsx` — dots + popup with page switching, adding, and delete
- Refactored `PootBox.tsx` — pages state, page switching logic, multi-page rendering
- Page transition animations (slide left/right,300ms)
- Initial page state: on first launch, show6 emojis on page 0 (cow, dog, cat, pig, duck, lion — the "classic" set)

**What gets removed:**
- The "all 12 always present" behavior — now only the emojis on the current page are rendered
- The first-load grid initialization (replaced by the Layout.ts placement algorithm)

**What stays the same:**
- AddMenu.tsx (unchanged from Phase 2)
- Recording flow
- Physics (unchanged — runs independently of which page is active)

**Files added/changed:** 3 files, ~280 lines new code  
**Bundle impact:** +5KB gzipped  
**After Phase 3:** The app has full multi-page support. The kid can add pages, switch between them, delete pages (except the first). Pages persist across sessions. This is the full v3.0 feature set.

---

### Phase 4: "Polish" — Animations, Sound Effects, Onboarding

**Goal:** Ship-quality feel. Every animation is right. Every sound is satisfying. The app feels like it was made by a game dev studio.

**What gets built:**
- **Add emoji animation:** spawn at top, fall under gravity, pop sound on landing
- **Remove emoji animation:** float-up-fade (or particle explosion — pick one after kid testing)
- **Refined tap spring:** finalize the spring curve constants after testing
- **Combo refinements:** after kid testing, tune the ×5 gold glow intensity and ×10 star burst
- **Landing "pop" sound:** a short Web Audio API sine burst (200Hz, 80ms, -20dB) on bubble landing
- **Canvas empty state:** if a page has 0 emojis, show a gentle hint: a slowly pulsing "+" in the center of the canvas (the ＋ button's icon,48px, opacity 0.3, breathing animation)
- **Onboarding overlay (optional, ship as-is if time permits):** a single screen on first launch showing3 bubbles floating, with a single "Tap a bubble!" hint that fades after 3 seconds. NOT a modal, NOT blocking. Just a gentle nudge.

**What gets removed:**
- Nothing

**What stays the same:**
- All Phase 1–3 features

**Files added/changed:** ~200 lines across existing files  
**Bundle impact:** +3KB gzipped  
**After Phase 4:** The app is ship-ready. Polish is subjective — if Cam feels it in Phase 4 review, ship it. If not, Phase 5 is the final cleanup.

---

### Phase 5: "Ship" — QA, Accessibility, Launch

**Goal:** Ship PootBox v3.0. Make it official. v3.0 on GitHub Releases.

**What gets built:**
- Final QA pass using the updated kid test sheet (Section 15 of this plan)
- Accessibility check: reduced motion mode tested, touch targets ≥ 44px, color contrast for all UI text
- Performance check: physics loop profiled on low-end Android (Samsung A14, ~$150), iPhone11
- Bundle size final measurement (target: < 90KB gzipped)
- `docs/v3-release-notes.md` — what changed, what to tell users
- GitHub Release: tag `v3.0.0`, upload the production build
- Update live URL (animals.ashbi.ca) to point to v3.0

**What gets removed:**
- Any debug-only code (console.logs, DEV toggles for simulate-premium, etc.)
- The `?v=v27-test` query param support (remove all test-flag code paths)

**Files added/changed:** Cleanup across all files  
**Bundle impact:** -2KB gzipped (cleanup)  
**After Phase 5:** PootBox v3.0 is live.

---

##13. Risks and Open Questions

### Risk 1: iOS Safari requestAnimationFrame Throttling

**What:** iOS Safari throttles `requestAnimationFrame` to 60fps but can also delay callbacks when the tab is backgrounded or the device is under load. The drift physics may look choppy on older iPhones (iPhone 11 and below).

**Mitigation:** Use `document.hidden` to pause the physics loop when the tab is not visible (saves battery and prevents drift accumulation when tab is backgrounded). Test on iPhone 11 before Phase 4. If choppy, reduce bubble count or simplify collision detection to skip non-overlapping pairs.

### Risk 2: IndexedDB Storage Limit

**What:** A kid who records 50+ sounds (each ~500KB–2MB WebM) could hit the browser's IndexedDB quota. On iOS Safari, this is typically 50MB–500MB depending on available disk space, but the browser may prompt the user or silently fail.

**Mitigation:** In Phase 3, add a storage usage indicator in the Settings modal: "Recordings:12 sounds, ~8MB." If storage is >80% of a conservative50MB limit, show a gentle warning: "Storage is almost full. Remove some recordings to add more." No hard enforcement — just information. Also: in `deleteRecording()`, always revoke blob URLs immediately to free memory.

### Risk 3: Add Menu Discoverability for 3-Year-Olds

**What:** The ＋ button is top-right,44px × 28px, cream pill. It is intentionally understated. A 3-year-old who is happy tapping existing bubbles may never discover it. Cam's own kid testing notes from v2.0 showed the ＋ button was found by most kids — but the new understated design may reduce discoverability.

**Mitigation:** In Phase 4, test with3-year-olds. If the add menu is not found, add a gentle periodic nudge: every 45 seconds of inactivity, the ＋ button does a subtle "breathe" animation (scale 1.0 → 1.08 → 1.0, 2s, once). This is not intrusive but draws the eye. Alternatively: on first launch, after the kid taps 5 bubbles, the＋ button does a single gentle pulse to hint at its existence.

### Risk 4: iOS Audio Unlock Timing

**What:** iOS Safari requires a user gesture to unlock audio playback. In v2.0, the ＋ button's long-press triggered the unlock. In v3.0, the ＋ button opens a menu — the first tap on a bubble (to play a sound) may be blocked by iOS audio autoplay restrictions if it happens before the first user gesture that isn't a tap on a bubble.

**Mitigation:** In `PootBox.tsx`, call `unlockAudio()` on ANY canvas interaction (tap on bubble, tap on blank area, tap on ＋ button). The audio unlock function is idempotent — calling it multiple times is safe. Ensure it is called at least once before the first `playSingle()` call.

### Risk 5: Reduced Motion Mode Is Not Truly Accessible

**What:** The "reduce motion" toggle in settings turns off drift and simplifies animations. But for kids with vestibular disorders, even the tap spring (scale 1.0 → 1.18 → 1.0) could be problematic. A simple toggle may not be sufficient for kids with specific accessibility needs.

**Mitigation:** Document the toggle clearly in the Settings modal ("Turn off drifting and bouncing for a calmer experience"). For v3.1, consider a "full reduce motion" mode that replaces the tap spring with a simple opacity flash (no scale change). This is a v3.1 item — not in scope for v3.0 launch.

### Risk 6: Bubble Drift on Low-End Android

**What:** The physics loop runs every frame. On low-end Android devices (Mediatek processors, 3GB RAM), the loop may run at 30fps or lower, making the drift look stuttery rather than calm.

**Mitigation:** In `Physics.ts`, detect low frame rate (if `dt > 33ms` for 3 consecutive frames, reduce the number of collision checks by using a spatial hash grid instead of O(n²) pair checks). This is a v3.1 optimization if needed.

### Risk 7: Page Transition Animation jank on Slower Devices

**What:** The page transition (slide left/right, 300ms) involves animating 6–8 bubble positions simultaneously. On a slow device, this could look janky.

**Mitigation:** The page transition uses CSS `transform: translateX()` on the canvas container — this is GPU-accelerated and should be smooth even on slow devices. Test on iPhone 11 and Samsung A14 in Phase 4 QA. If janky, fall back to a simple opacity crossfade (no slide).

### Risk 8: What If the Kid Wants to Rename a Page?

**What:** The pages system has no naming. Pages are just ordered, sequential positions. A5-year-old who creates a "Dinosaurs" page and a "Farm" page may want to label them. The current design has no mechanism for this.

**Mitigation:** This is explicitly out of scope for v3.0. Pages are for the app to manage, not the kid. If the naming demand is real (from kid testing), add a v3.1 item: long-press on a dot → inline text edit for a page name (max 16 characters, stored in localStorage). The name is shown in the pages popup.

---

## 14. Success Metrics

### Engagement Metrics

- **Session duration:** Median session ≥ 5 minutes. Measured via a session start timestamp in memory (not persisted). "Session" = from app open to app close (visibility change or page hide).
- **Repeat sessions:** ≥ 30% of users who open the app a second time within 7 days. Measured via localStorage: `pootbox-last-session` timestamp.
- **Bubble tap rate:** ≥ 20 taps per session (median). If they're tapping a lot, they're engaged.

### Creator Metrics

- **Recording rate:** ≥ 20% of sessions include at least one recording. Measured by checking if `recPhase` reached "picking" state during the session.
- **Recordings per creator session:** Median ≥ 2 recordings per session for sessions that include recording.
- **Pages created:** ≥ 15% of sessions that include recording also create a second page. This is the "I'm building a collection" behavior.

### Discovery Metrics

- **＋ button discovery:** ≥ 70% of sessions where the kid taps 10+ bubbles also include at least one tap on the ＋ button. Below70% means the button is not discoverable enough.
- **Library vs. Record:** Among sessions where ＋ is tapped, ≥ 60% are Library taps (adding from library) and ≤ 40% are Record taps. If Record is >50%, the library is not compelling enough.
- **Page system usage:** ≥ 20% of sessions create a second page. Below 20% means the feature is not needed — cut it in v3.1 and simplify.

### Quality Metrics

- **Audio failure rate:** ≤ 1% of taps result in no sound. Measured by counting taps where `playSingle()` throws or the `ended` event never fires within 2 seconds.
- **Zero parent-support sessions:** ≥ 80% of sessions have no parent interaction (no taps on the canvas by what looks like an adult finger — detected by touch size > 40px or tap pattern matching adult behavior). This is an approximation.
- **Error rate:** Zero uncaught JS errors per session. Any `try/catch` in the physics loop should log to `console.error` for monitoring.

---

## 15. Test Plan

### Kid Testing Observation Sheet (v3.0)

Adapt the existing `docs/kid-test-sheet.md` for v3.0. Key additions and changes:

---

**Section 1: First30 Seconds (update)**

- [ ] Did they notice the bubbles were moving (drifting)? Or did they just see "things on screen"?
- [ ] What was their first action: tap a bubble, tap the＋ button, tap blank space, or do nothing?
- [ ] If they tapped a bubble: which one? (Built-in or one they added?)
- [ ] Did they tap the same bubble twice? (Tests: did they notice it makes a sound each time?)
- [ ] Did they tap different bubbles or just one repeatedly?

**Section 2: Core Loop Discovery (new)**

- [ ] Did they discover the drag? (Pick up a bubble, move it, release.) If yes: did they throw it? Drop it near another bubble?
- [ ] Did they notice bubbles bump each other? Did they react?
- [ ] Did they tap rapidly enough to trigger a combo? (×5 gold glow at 5 rapid taps.) Did they react to the gold glow?
- [ ] Did they tap rapidly enough to trigger stars? (×10.) Did they react?

**Section 3: The＋ Button (update)**

- [ ] Did they find the ＋ button? (Top-right, cream pill. Note: it is smaller and softer than the old white circle.)
- [ ] If they tapped it: what did they do first — tap "Library" or "Record"?
- [ ] If they went to Library: did they tap an emoji to add it? Which one?
- [ ] If they went to Record: did they complete the recording? Which emoji did they pick?
- [ ] Did they try to add more than 8 emojis? What happened when they hit the limit?

**Section 4: Pages System (new)**

- [ ] Did they notice the dots at the bottom? (The page indicator.)
- [ ] Did they tap a dot to switch pages?
- [ ] Did they create a new page? (Via the pages popup, ＋ button inside it.)
- [ ] Did they delete a page? (Long-press on a dot.)
- [ ] What did they name it, if anything? (If they expected naming and it wasn't there, note that.)

**Section 5: Settings (update)**

- [ ] Did they discover the settings? (5-second hold on blank area.)
- [ ] Did they change the volume?
- [ ] Did they toggle reduce motion?
- [ ] Did they find the "Reset all pages" button? (Note: this is for parents. A kid finding it and tapping it is a UX problem — the confirmation should be clear enough that even a5-year-old pauses.)

**Section 6: Session End (update)**

- [ ] How long did they play? ____ minutes ____ seconds
- [ ] What did they do at the end: put the device down, ask for another app, ask to do it again?
- [ ] Did they say the name of an animal? (Verbatim: _________)
- [ ] Did they ask to record another sound?
- [ ] Did they ask about the bubbles ("why are they moving?")

**Section 7: Parent Perspective (update)**

- [ ] Was the first 30 seconds a win or a loss? _____________
- [ ] Did the app make them feel like a creator or a consumer? _____________
- [ ] What's the ONE thing to fix before showing it to another kid? _____________
- [ ] What's the ONE thing to keep that I'd be tempted to remove? _____________
- [ ] **NEW:** Did the app feel like it was made by a real company (Sago Mini quality)? Or does it still feel like a prototype? Rate: 1 (prototype) to 5 (polished product).

---

## Appendix: v2.0 → v3.0 Feature Delta

| Feature | v2.0 | v3.0 | Change |
|---|---|---|---|
| 4×3 grid layout | ✅ | ❌ (replaced) | Grid → floating random |
| Colored circle backgrounds | ✅ | ❌ (replaced) | → Soft white bubbles |
| Hero circle pulse | ✅ | ❌ (replaced) | → Equal drift, no hero |
| All 12 emojis always present | ✅ | ❌ (replaced) | →6–8 per page, configurable |
| ＋ direct to recording | ✅ | ❌ (replaced) | → ＋ opens menu |
| Single page | ✅ | ❌ (replaced) | → 8 pages |
| No sound on appear | ❌ (some collision sounds) | ✅ | Silent drift |
| Pages system | ❌ | ✅ | New |
| Library tab | ❌ | ✅ | New |
| Add/remove from canvas | ❌ | ✅ | New |
| Combo system | ✅ | ✅ | Kept unchanged |
| Recording flow | ✅ | ✅ | Kept (moved to menu tab) |
| Shake to randomize | ✅ | ✅ | Kept unchanged |
| Hidden settings | ✅ | ✅ | Kept (5-sec hold) |
| Mic permission handling | ✅ | ✅ | Kept unchanged |
| IndexedDB recordings | ✅ | ✅ | Kept unchanged |
| Single-voice audio | ✅ | ✅ | Kept unchanged |
| Spark particles on collision | ✅ | ✅ | Kept unchanged |
| Ripple on tap | ✅ | ✅ | Kept (refined) |
| Confetti at10 taps | ✅ | ✅ | Kept unchanged |
