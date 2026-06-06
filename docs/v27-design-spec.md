# v27 Design Spec — Upload Sound card + Premium upgrade card
**Sam, Designer —2026-06-06**
**For Diego, implementing in React + Tailwind**

---

## CARD 1: Upload Sound

### Who is this for
Parents who want to swap a farm animal's default sound for their kid's own recording or a custom audio file.

### What's wrong with the obvious approach
The obvious approach is a flat list of file inputs — one per thing — which is dense, easy to mis-tap, and gives no confirmation of which sound is currently active.

### Layout sketch

```
┌─────────────────────────────────────┐
│ 🎵 Custom sounds                   │
│     Swap any thing's sound          │
├─────────────────────────────────────┤
│ 🐄 Cow 📤 uploaded by you  [✕]│
│ 🐷 Pig         Default sound        [+]│
│ 🐴 Horse Default sound        [+]│
│ 🐔 Chicken     Default sound        [+]│
│ ...                                │
└─────────────────────────────────────┘
```

`[+]` = "Choose file" button (tertiary style, outlined)
`[✕]` = "Remove" button (only shown for uploaded sounds, text-only red)

Scrolling list of things. Card is the5th card in the 2×3 grid.

### Color usage
- Card shell: `bg-white rounded-2xl shadow-sm border border-amber-100 p-4` (matches all other cards)
- Emoji: `text-2xl`
- Title: `font-bold text-amber-900`
- Subtitle: `text-xs text-amber-600`
- Thing row label: `text-sm text-amber-800`
- "uploaded by you" badge: `text-xs text-sky-600 bg-sky-50 rounded-full px-2 py-0.5`
- "Default sound": `text-xs text-amber-400 italic`
- Choose file button: `text-sm text-amber-700 border border-amber-300 hover:border-amber-500 hover:text-amber-900 rounded-lg px-3 py-1.5`
- Remove button: `text-xs text-red-500 hover:text-red-700`
- Progress bar: `bg-amber-200 rounded-full h-2`, fill `bg-amber-500`
- Error text: `text-xs text-red-500 mt-1`

### Interaction states

**Idle:** Rows show current state — "Default sound" or "📤 uploaded by you [✕]"

**Hover/tap on [+]:** Border darkens, text darkens. No background fill (outlined button).

**File picker open:** Native OS file picker, `accept="audio/mpeg,audio/mp3"`.

**Loading (file selected, > 500KB):** Row shows a thin `bg-amber-200` progress bar beneath it, animating to `bg-amber-500` as the file loads. Button text changes to "Uploading..." and becomes `disabled`.

**Success:** The row immediately updates to show "📤 uploaded by you [✕]". Brief green flash on the row (`bg-green-50` for 600ms then back to white).

**Error — too large (>5MB):** Red error text below that row: "File too big — max 5 MB". The error text persists until the user picks a new file.

**Error — wrong type:** Red error text: "Only MP3 files are supported". Same persistence behavior.

**Remove:** Confirm is not required — one tap removes it. Row snaps back to "Default sound" state immediately.

### Copy (every visible string)
- Card title: `Custom sounds`
- Card subtitle: `Swap any thing's sound`
- Row default: `Default sound`
- Row uploaded badge: `📤 uploaded by you`
- Choose file button: `Choose file`
- Uploading state: `Uploading...`
- Remove button: `Remove`
- Error — size: `File too big — max 5 MB`
- Error — type: `Only MP3 files are supported`

### Motion
No card-level animation. Row success flash: `transition-colors duration-300 bg-green-50` for 600ms then `bg-white`. Progress bar uses native CSS transition on width.

---

## CARD 2: Premium upgrade

### Who is this for
Parents who haven't yet paid, or who have already paid — the same card serves both states.

### What's wrong with the obvious approach
The obvious approach is a banner or interstitial that interrupts the dashboard. The card should live in the grid like any other setting, and the upgrade CTA should feel like a natural part of the dashboard, not a pop-up ad.

### Layout sketch (card)

```
┌─────────────────────────────────────┐
│ 💎  Premium                         │
│     ✨ Upgrade to Premium │
│                                     │
│     $1.99/mo or $14.99/yr           │
│     •3 profiles │
│     • Custom sounds                 │
│     • Pitch shift │
│                                     │
│     [  Upgrade — $14.99/yr  ]       │
└─────────────────────────────────────┘
```

**Premium active state:**
```
┌─────────────────────────────────────┐
│ 💎  Premium                         │
│     ✓ Premium unlocked              │
│     (green check, no CTA) │
└─────────────────────────────────────┘
```

### Color usage
- Card shell: same as all cards
- Tier badge (unlocked): `text-sm text-green-700 bg-green-50 rounded-full px-3 py-1`
- Upgrade CTA: `bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl w-full`
- Price text: `text-xs text-amber-600`
- Bullet points: `text-sm text-amber-700`
- Unlocked check: `text-green-600`

### Modal layout

```
┌─────────────────────────────────────┐
│          Poot Party Premium         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ○ Monthly — $1.99/mo         │   │
│  └─────────────────────────────┘   │
│ ┌─────────────────────────────┐   │
│  │ ● Yearly — $14.99/yr  save 37%│   │
│  └─────────────────────────────┘   │
│                                     │
│  [         Continue          ]      │
│  [         Cancel            ]      │
│                                     │
│  ── DEV ── │
│  [ ] Simulate premium │
└─────────────────────────────────────┘
```

### Modal color usage
- Overlay: `bg-black/40 backdrop-blur-sm`
- Modal card: `bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full`
- Modal header: `text-xl font-bold text-amber-900 text-center`
- Radio card default: `border-2 border-amber-200 rounded-xl p-4 cursor-pointer hover:border-amber-400`
- Radio card selected: `border-2 border-amber-500 bg-amber-50 rounded-xl p-4`
- Radio dot: `w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center` + inner dot `w-2.5 h-2.5 rounded-full bg-amber-500` (shown when selected)
- "Save 37%" chip: `text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium`
- Continue button: `bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl w-full`
- Cancel button: `text-amber-600 hover:text-amber-900 text-sm font-medium py-2`
- DEV toggle row: `border-t border-amber-100 mt-4 pt-4 flex items-center gap-2`
- DEV label: `text-xs text-amber-400`

### Interaction states

**Card — Free tier idle:** See layout above. CTA button at bottom.

**Card — Free tier hover on CTA:** Button darkens `bg-amber-600`.

**Card — Premium active:** Green "✓ Premium unlocked" badge, no button. Card is visually "done".

**Modal — idle:** Yearly card pre-selected (radio dot filled). Monthly card outlined.

**Modal — tap Monthly:** Monthly card gets selected ring + fill, yearly loses it.

**Modal — tap Yearly:** Yearly card gets selected ring + fill, monthly loses it.

**Modal — Continue:** Button shows `opacity-75 cursor-wait` briefly, then triggers Stripe placeholder (console.log for now per v27 scope).

**Modal — Cancel:** Modal closes, no state change.

**Modal — DEV toggle:** Checkbox toggles `localStorage.premium`. UI updates immediately to reflect new tier state. Toggle is visible only when `import.meta.env.DEV` is true.

### Copy (every visible string)
- Card title: `Premium`
- Free state tagline: `✨ Upgrade to Premium`
- Free state prices: `$1.99/mo or $14.99/yr`
- Bullet 1: `3 profiles`
- Bullet 2: `Custom sounds`
- Bullet 3: `Pitch shift`
- CTA button: `Upgrade — $14.99/yr`
- Premium unlocked badge: `✓ Premium unlocked`
- Modal header: `Poot Party Premium`
- Monthly radio label: `Monthly — $1.99/mo`
- Yearly radio label: `Yearly — $14.99/yr`
- Save chip: `save 37%`
- Continue button: `Continue`
- Cancel button: `Cancel`
- DEV toggle label: `DEV: simulate premium`

### Motion
No card-level animation. Modal: `transition-opacity duration-200` for backdrop, `transition-transform duration-200` for modal slide-up from center. Radio card selection: `transition-all duration-150` on border + background-color.

---

## Implementation notes for Diego

**Shared card shell (copy from any existing card):**
```tsx
<div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
<div className="flex items-center gap-2 mb-4">
    <span className="text-2xl">{emoji}</span>
    <div>
      <h2 className="font-bold text-amber-900">{title}</h2>
      <p className="text-xs text-amber-600">{subtitle}</p>
    </div>
  </div>
  {/* card body */}
</div>
```

**Upload card file input (hidden, triggered by button):**
```tsx
<input
  type="file"
  accept="audio/mpeg,audio/mp3"
  className="hidden"
  ref={fileInputRef}
  onChange={handleFileChange}
/>
```

**Premium modal portal:** Render in `document.body` via `createPortal`, with a `bg-black/40 backdrop-blur-sm` overlay div. Close on overlay click or Cancel button.

**Premium tier check:** `const isPremium = localStorage.getItem('premium') === 'true'`. Read on mount, subscribe to `storage` event for cross-tab sync.

**DEV simulate toggle:** `import.meta.env.DEV` guard. On toggle change: `localStorage.setItem('premium', checked ? 'true' : 'false')` then dispatch `window.dispatchEvent(new Event('storage'))`.

**Card grid position:** Both cards slot into the existing `max-w-md mx-auto px-3 py-4 space-y-3` dashboard as cards 5 and 6.
