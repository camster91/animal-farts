# v28 Design Spec — Welcome screen + TV mode + Share code import
**Sam, Designer — 2026-06-06**
**For Diego, implementing in React + Tailwind**

---

## SURFACE 1: Welcome screen (💨 mascot intro)

### Who is this for
4-year-olds opening the app for the first time, before they ever see a scene.

### Layout sketch

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│ │
│ 💨                               │
│                  (eyes + smile)                     │
│               120px emoji, centered │
│                                                     │
│     Tap things to make sounds!                      │
│     Tap and hold to make your own.                  │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
         full-screen, gold bg (#fbbf24)
```

### Color usage
- Background: `bg-amber-400` (gold — primary brand)
- Mascot: `💨` emoji at120px
- Copy: `text-white font-bold text-xl text-center` with subtle drop-shadow for legibility
- Subtle scrim behind text: `text-shadow: 0 2px 8px rgba(0,0,0,0.3)`

### Interaction states

**Idle:** Full-screen gold, 💨 centered, copy below.4s timer starts on mount.

**Tap anywhere:** Dismisses immediately. Fade-out: `opacity1→0,300ms ease-out`.

**Auto-dismiss (4s):** Same fade-out as tap.

**After dismiss:** Never shown again on this device (`localStorage` key `poot-party-welcome-seen`).

### Copy (every visible string)
- Line 1: `Tap things to make sounds!`
- Line 2: `Tap and hold to make your own.`

### Motion
- Entrance: `opacity 0→1, 400ms ease-out` on mount (scene entrance finishes first)
- Exit: `opacity 1→0, 300ms ease-out` — either tap or4s timer
- No bounce/pulse on the 💨 (FirstTapHint already does that; welcome screen is calmer)

### Implementation notes for Diego
- `localStorage` key: `poot-party-welcome-seen`
- 4s timer: `window.setTimeout(() => dismiss(), 4000)` after a 400ms entrance delay
- Dismiss on `pointerdown` (not `click`) for instant response
- Render before the profile picker mount — this is the very first thing a new device sees
- No nav chrome, no dots, no badge visible during welcome screen

---

## SURFACE 2: Poot Party TV mode

### Who is this for
A kid (or parent) who wants to just watch — no interaction required.

### Layout sketch

```
┌─────────────────────────────────────────────────────┐
│                                          [✕ Exit]  │ ← top-right,44px tap target
│                                                     │
│                                                     │
│              [full-screen scene]                   │
│              [thing emoji, centered]                │
│                                                     │
│                                                     │
│                                                     │
│                                       [▶ Next]     │  ← bottom-right, 44px tap target
└─────────────────────────────────────────────────────┘
         NO dots, NO badge, NO nav chrome
```

### Color usage
- Scene: full-bleed, same scene JPG as kid's app
- Exit button: `text-white text-sm font-medium opacity-80 hover:opacity-100` with tap target 44px
- Next button: `bg-white/20 backdrop-blur-sm text-white font-bold text-sm rounded-full px-4 py-2`
- Cross-fade overlay: `bg-black/10` briefly during transition

### Interaction states

**Idle — playing:** Full scene, thing emoji centered, auto-playing its first sound. No chrome.

**Tap Next (bottom-right):** Cross-fade to next scene (outgoing: `opacity 1→0, 500ms`; incoming: `opacity 0→1, 500ms ease-in`). New scene's first thing auto-plays after200ms delay.

**Tap Exit (top-right):** Immediately returns to profile picker. No animation.

**TV mode active:** No 🏆 badge, no 💨 floating button, no scene dots — none of the kid-app chrome.

### Copy (every visible string)
- Exit button: `✕ Exit`
- Next button: `▶ Next`

### Motion
- Scene cross-fade: `transition-opacity duration-500 ease-in-out` on the scene container
- Next button: subtle `scale-95→100` on tap, `duration-100`
- Entrance: `opacity 0→1, 400ms ease-out` when TV mode mounts
- Exit: instant (no fade)

### Implementation notes for Diego
- TV mode mounts as a full-screen overlay (`position: fixed; inset: 0; z-index: 200`)
- Scene order: Farm → Jungle → Ocean → Home → repeat (same4-scene cycle as swipe)
- Each scene shows the FIRST thing in that scene's table (Cow, Elephant, Whale, Door)
- Auto-advance: after the first thing's sound ends, wait 1.5s, then cross-fade to next scene
- "Next" button skips the1.5s wait and triggers immediate cross-fade
- `prefers-reduced-motion`: skip cross-fade, instant scene swap; auto-advance still fires on sound-end timer
- Exit button uses `✕` (U+2715), not `×` — cleaner at small sizes

---

## SURFACE 3: Share code import card

### Who is this for
Parents who received a 4-character code from another parent and want to import that kid's profile and recordings.

### Layout sketch (card)

```
┌─────────────────────────────────────────────────────┐
│  🔗  Import a profile │
│      Enter a 4-letter code to see a shared profile   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  [ ]  [ ]  [    ]  [    ]            │   │  ← 4 separate single-char inputs
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [ Look up              ]              │  ← primary CTA
│                                                     │
│  Or: Use my code — see Share code card              │  ← helper link
└─────────────────────────────────────────────────────┘
```

**Result modal:**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│ 💨 Profile found!                        │
│                                                     │
│         🐄 Cow · Farm                               │
│         "Lily" · 12 sounds                          │
│         Shared 2 hours ago                          │
│                                                     │
│         [       Import ]                      │
│         [       Cancel       ]                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Color usage
- Card shell: `bg-white rounded-2xl shadow-sm border border-amber-100 p-4` (matches all /parent cards)
- Title: `font-bold text-amber-900`
- Subtitle: `text-xs text-amber-600`
- Input boxes: `bg-amber-100 border-2 border-amber-300 rounded-xl w-12 h-14 text-center text-2xl font-mono font-bold text-amber-900`
- Input focus: `border-amber-500 ring-2 ring-amber-200`
- Input error: `border-red-400 bg-red-50`
- Look up button: `bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl w-full`
- Look up loading: `opacity-75 cursor-wait`
- Helper link: `text-xs text-amber-500 hover:text-amber-700`
- Modal overlay: `bg-black/40 backdrop-blur-sm`
- Modal card: `bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full`
- Modal emoji: `text-4xl`
- Modal kid name: `text-xl font-bold text-amber-900`
- Modal detail line: `text-sm text-amber-600`
- Import button: `bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl w-full`
- Cancel button: `text-amber-600 hover:text-amber-900 text-sm font-medium py-2`

### Interaction states

**Card — idle:**4 input boxes empty, Look up button disabled (opacity-50) until 4 chars entered.

**Card — typing:** Each box takes1 character. Auto-advances to next box on input. Backspace moves to previous box.

**Card — all 4 filled:** Look up button becomes active (`opacity-100 cursor-pointer`).

**Card — Look up tap + loading:** Button text → `Looking up...`, `opacity-75 cursor-wait`. Inputs disabled.

**Card — error (invalid code):** Each input box gets `border-red-400 bg-red-50`. Error text below: `No profile found for that code`. Inputs cleared, focus on first box. Button resets to `Look up`.

**Modal — idle:** Shows kid emoji, name, scene, sound count, time since share. Import + Cancel buttons.

**Modal — Import tap:** `opacity-75 cursor-wait` briefly, then closes modal + triggers import flow.

**Modal — Cancel tap:** Modal closes, no state change.

### Copy (every visible string)
- Card title: `Import a profile`
- Card subtitle: `Enter a 4-letter code to see a shared profile`
- Input placeholder: `?` (each box)
- Look up button: `Look up`
- Loading state: `Looking up...`
- Error state: `No profile found for that code`
- Helper link: `Or: Use my code — see Share code card`
- Modal header: `💨 Profile found!`
- Modal detail — emoji + scene: `🐄 Cow · Farm` (assemble from metadata)
- Modal detail — name + count: `"Lily" · 12 sounds`
- Modal detail — time: `Shared 2 hours ago` (relative time)
- Import button: `Import`
- Cancel button: `Cancel`

### Motion
- Card entrance: `transition-opacity duration-200` (matches other cards)
- Input focus ring: `transition-all duration-150`
- Error shake: `animation: shake300ms ease-in-out` on the input row (horizontal wiggle)
- Modal: backdrop `transition-opacity duration-200`, card `transition-transform duration-200` slide-up from center
- Success (import complete): brief `bg-green-50` flash on the card row,400ms

### Implementation notes for Diego
- 4 separate `<input maxLength={1}>` boxes — auto-focus next on input, prev on backspace
- Input filtering: `e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase()`
- On 4th input, auto-submit the lookup (don't require button tap)
- API call: `GET /api/share/{code}` → returns `{ kidName, scene, emoji, soundCount, sharedAt }` or 404
- Error404: show error state inline, no modal
- Error network: `Something went wrong — try again` with retry button
- Import action: `POST /api/share/{code}/import` → creates profile locally
- The "Use my code" helper scrolls to the Share code card on the same page (anchor link or scrollIntoView)
- Modal renders via `createPortal` to `document.body`
- Close on overlay click or Cancel button

---

## Design choices I made

1. **Welcome screen uses gold background** — the brand's primary color. FirstTapHint uses a dark overlay because it's layered on top of a scene; the welcome screen IS the screen, so it earns the full gold treatment. The copy is white with a soft drop-shadow for legibility on gold.

2. **TV mode shows only the FIRST thing per scene** — not all 12 things. This keeps it focused and calm. The "Next" button manually advances; auto-advance fires after the sound ends + 1.5s pause. This gives the watcher time to register what just played before it changes.

3. **Share code import uses 4 separate single-char inputs** — not one text field. Easier for kids (one tap per character, no delete mistakes) and matches how kids' apps handle short codes (AirDrop, etc.). Auto-submit on4th character so the flow is as fast as possible.

---

**File:** `docs/v28-design-spec.md`
**Commit:** `v28-design-spec: Sam's design for welcome + TV + share import`
**Ship it.**
