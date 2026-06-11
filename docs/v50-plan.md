# PootBox v50 — UI cleanup (the "messy" audit)

**Date:** 2026-06-11
**Status:** ready to execute
**Goal:** the v47-v49 wave added 5+ new controls (Volume, Share, Install, Update, Category chips, Show-welcome) into an already-overcrowded top-right corner. The result is overlapping buttons, redundant onboarding prompts, and a stacked-banner mess. v50 reorganizes the layout before adding any more features.

---

## Vision

The app's main canvas is a fixed-position div (`PootBox.tsx:905-921`) with `position: fixed; inset: 0`. Everything — page tabs, add-sound button, volume, share, install banners, update banners, category chips, onboarding hint, the bubbles themselves — is a child of this fixed div. **This architecture is the root cause of the mess.** New controls get piled into the top-right corner because there's no other place to put them.

v50 fixes the layout. No new features. No new components (except a single "footer bar" container). No new pages.

---

## The 5 root causes (verified from real DOM)

1. **Add sound / Volume / Share / Page tabs / Add new page** all overlap at the right edge (x: 1168-1264, y: 22-160). 5 controls in a 96×138px area.

2. **Chip row's `position: sticky` doesn't work** because the parent is `position: fixed`. The chips render at top: 72 (just below the page tabs) but they're in normal flow, so they get covered by the page tabs which are also at top: 16. Verified at runtime: computed `position: static, zIndex: auto` on the chip row, not sticky.

3. **First-run intro + "Tap a sound!" callout are competing onboarding prompts.** The intro modal covers the canvas; the callout is also trying to direct attention. Dismiss one, the other is still there.

4. **PWA install + SW update banners stack at the bottom**, both full-width, different colors. Even when both are showing they're 60px each = 120px of bottom chrome.

5. **No app identity at the top.** No logo, no "PootBox" wordmark. The 12 animal bubbles have no anchoring brand. The page is just a yellow field with floating controls.

---

## The fix: a proper top bar + footer bar layout

Right now controls are scattered. The fix is a single top bar (logo + page tabs on the left, controls on the right) and a single footer bar (banners stack INSIDE the footer, not over the canvas). Bubbles get the whole middle.

### Layout target

```
┌─────────────────────────────────────────────────────┐
│  💨 PootBox   [Page tabs]              [+] [Share] [Vol] │  ← top bar (60px, sticky to top)
├─────────────────────────────────────────────────────┤
│                                                       │
│  [Animals] [Farts] [Silly] [Instruments]              │  ← chip row (only on default page)
│                                                       │
│                  🐄    🐕                              │
│             🐈             🐖                           │  ← bubble canvas (the WHOLE area)
│       🦆                       🦁                     │
│   🐸                               🐒                 │
│                                                       │
│                                                       │
├─────────────────────────────────────────────────────┤
│  [📱 Install PootBox]                       [×]      │  ← footer (PWA install, dismissible)
│  [🆕 New version available — Reload]         [×]    │  ← footer (SW update, only if newer SW)
└─────────────────────────────────────────────────────┘
```

### Specific changes

**T1. Top bar (`src/pootbox/PootBox.tsx` + small new `TopBar.tsx` component):**
- A single 56px-tall sticky-positioned bar at the top of the canvas
- **Left side:** 💨 logo + "PootBox" wordmark (small, Fredoka 600, #3D2C1E, 14px) + horizontal page tab strip + Add new page button (the existing `➕` from v49-p4)
- **Right side:** Volume icon, Share icon, Add sound icon — 3 buttons, evenly spaced, 40px each, no longer floating at 72/116 y-coords
- Background: same yellow gradient as the canvas, with a subtle bottom border (1px rgba(0,0,0,0.06)) for separation
- z-index 200 (above bubbles, below modals)

**T2. Replace floating controls with TopBar children:**
- Remove the 3 floating controls from PootBox.tsx (Volume at top:64, Share at top:116, Add sound at top:72) — they move INTO the TopBar
- Keep the `Add new page` button in PageTabs (it was already part of the tab strip)
- The `🏠` page tab icon moves to the leftmost position in the bar (replacing the old "Page: Sounds" approach — but tab aria-label still says "Page: <name>")

**T3. Fix the chip row (actually make sticky work):**
- The chip row needs to be in its own scroll container, OR the parent needs to NOT be `position: fixed`
- Easiest fix: the chip row's parent is the BubbleCanvas, which is `position: fixed; inset: 0`. We can make the chip row `position: fixed; top: 56px; left: 0; right: 0;` (fixed below the top bar) so it actually works as intended
- Alternative: keep the chip row in normal flow but move it to BELOW the bubbles (above the footer). That's uglier.
- Decision: `position: fixed; top: 56px` on the chip row. The bubble canvas is already position: fixed; the chip row living in fixed too is consistent.

**T4. Footer bar (`src/pootbox/components/FooterBar.tsx` new component):**
- A single 60px-tall sticky-positioned bar at the bottom of the canvas
- Contains: PWA install banner (dismissible), SW update banner (only if newer SW)
- The two banners stack INSIDE the footer (one at a time, not both at once)
- If neither banner is showing, the footer is invisible (display: none, or just empty)
- Background: white with a subtle top border, 1px rgba(0,0,0,0.06)
- z-index 200 (above bubbles, below modals)

**T5. Consolidate onboarding:**
- Remove the "Tap a sound!" callout (`OnboardingHint`) when the first-run intro is showing (or vice versa — pick one)
- Decision: keep the first-run intro (it's a fullscreen modal, harder to miss), remove `OnboardingHint` from the default render
- If we ever want to bring back the in-canvas onboarding hint, do it AFTER the first-run intro dismisses and only on the default page

**T6. Show welcome again link lives in Settings (already there) — no change.**

**T7. Reduce-motion warning in Settings stays. No change.**

---

## Build steps (one commit per file)

```
v50-t1: new TopBar.tsx + wire into PootBox.tsx (left: logo+wordmark+pagetabs, right: 3 controls)
v50-t2: remove the 3 floating controls from PootBox.tsx (Volume/Share/AddSound move into TopBar)
v50-t3: fix the chip row — position: fixed; top: 56px (under the top bar)
v50-t4: new FooterBar.tsx (PWA install + SW update stack inside one bar)
v50-t5: remove OnboardingHint from default render (only show after first-run dismiss)
v50-deploy: redeploy + verify on live
```

**Build gates:**
- `npm run build` clean
- `npm run lint` 0 errors
- `npm test` 81+ pass (no new tests — this is pure layout work)

**Verification (after v50-deploy):**
- [ ] No control overlaps at the right edge (DOM check: no 2 controls share x: 1168-1264 and y: 22-160)
- [ ] PootBox wordmark + 💨 logo visible at top-left
- [ ] Chip row is at top: 56px (under the top bar) and visible on the default page
- [ ] PWA install + SW update banners are in a single footer bar at the bottom (not floating mid-screen)
- [ ] First-run intro OR onboarding hint, not both at once
- [ ] 12 bubbles visible in the middle, no overlap with any control
- [ ] All 81+ tests pass
- [ ] No console errors

---

## Out of scope (deferred to v51+)

- Refactor PootBox.tsx (1,425 lines) — overdue
- Offline support (SW caches the bundle)
- Keyboard accessibility
- Error boundary
- Export recordings feature
- iOS Safari swipe-back fix
- Share codes with longer entropy
- /api/usage observability endpoint
- pm2 / auto-restart
- Real Open Graph meta tags (for sharing on iMessage/Twitter)
- Real Plausible analytics
- App icon redesign (currently the 💨 emoji is the icon)
- "What's new" / changelog page
- Server-side share-code rate-limit
- Privacy page on a real domain (ashbi.ca/pootbox/privacy.html)
- All the Play Store ship-to-public items (keystore, AAB, screenshots, etc.)
