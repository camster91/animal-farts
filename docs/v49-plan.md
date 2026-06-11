# PootBox v49 — UI polish pass

**Date:** 2026-06-11
**Status:** ready to execute
**Goal:** close the polish gaps surfaced in the v48 live walkthrough. Small, targeted fixes — no new features.

---

## 5 issues, one commit each

### P1. Page emoji doesn't update when homeCategory changes
- **Symptom:** User taps "Farts" chip. Bubbles switch to farts. But the page tab still shows the 🏠 house icon. Plan said it should show 💨.
- **Root cause:** The chip onClick calls `setPages(prev => { const updated = createDefaultPage(value); ...; next[idx] = { ...updated, id, createdAt }; ... })` — it spreads `updated` which already has the new emoji. **Wait, this should work.** Let me re-verify. If the emoji doesn't update, the bug is that the `Page` type's `emoji` field isn't being read by PageTabs when rendering the tab icon, OR `createDefaultPage` returns the wrong emoji.
- **Fix:** Inspect both. In `recordings.ts`, the emoji is set via a mapping. In `PageTabs.tsx`, find the render of the tab icon. Either the map is wrong or PageTabs reads from a different field.
- **Test:** Add a test for `createDefaultPage` that asserts each category's emoji (already exists in `tests/unit-default-page.test.mjs`).

### P2. Home category chips overlap with page tabs
- **Symptom:** Both are at top-right of the canvas. The 4 category chips sit above the page tab strip. On a narrow screen (320-380px wide) the chips wrap and may overlap the tabs.
- **Fix:** Move the category chips BELOW the page tabs (z-index stack), and constrain their width to `max-width: calc(100vw - 32px)` with `overflow-x: auto` so they scroll horizontally instead of wrapping. Position with `position: sticky; top: 64px; z-index: 50` so they sit just under the page tabs and stick during scroll.

### P3. PWA install + SW update banners stack on the same screen
- **Symptom:** Both banners appear at the bottom of the screen. If the user just dismissed the SW update, the install prompt shows. If they dismissed the install, the SW update shows. The two banners stack with no visual hierarchy.
- **Fix:** Move them to the same side, with a clear stacking order. Install banner at the **bottom** (`bottom: 0`), SW update banner **just above it** (`bottom: 70px`). Both with a 60px height. Give the SW banner a slightly different background (blue, not black) so they're visually distinct.

### P4. "Add new page" + "Add sound" both look like `+` buttons
- **Symptom:** `e25` (Add new page) and `e8` (Add sound) are both small dark-brown circles with a `+` glyph. Visually identical. A kid or parent can't tell which is which.
- **Fix:** Change "Add new page" to a different glyph — `➕` (with the + sign larger) or `📄` (page icon). Or change the position — the Add new page is part of PageTabs, the Add sound is the standalone +. Different contexts are fine, but they should look different. The cleanest fix: PageTabs's "Add new page" already sits next to the page tab pills; add a tooltip/aria-label. The standalone "Add sound" stays a `+`. **Action:** make PageTabs's add button a `+` inside a slightly larger pill (40px instead of 36px) with a clear "New" text label or a different glyph. The "Add sound" stays as the dark-brown circle.

### P5. Returning users can never re-trigger the first-run intro
- **Symptom:** First-run intro is gated on `localStorage.getItem("pootbox-firstrun-done")`. If the user dismisses it accidentally or wants to re-see it, there's no way.
- **Fix:** Add a "Show welcome again" link/button in the Settings modal that clears the localStorage flag + reloads. The link sits next to the Privacy/About links.

---

## Build steps (one commit per item)

```
v49-p1: page emoji updates with homeCategory
v49-p2: home category chips sticky below page tabs (no overlap)
v49-p3: PWA + SW banners stack with clear hierarchy
v49-p4: disambiguate Add new page vs Add sound
v49-p5: Settings modal "Show welcome again" link
```

**Build gates per commit:**
- `npm run build` clean
- `npm run lint` 0 errors
- `npm test` 81+ pass (no new tests required unless pure helpers added)

**Verification (after v49-deploy):**
- [ ] Tap "Farts" chip → page tab icon becomes 💨 (was 🏠)
- [ ] Page tabs and category chips don't overlap on 320px-wide screens
- [ ] PWA install + SW update banners don't visually conflict
- [ ] Add new page + Add sound are visually distinct
- [ ] Settings modal: "Show welcome again" link clears localStorage and reloads
- [ ] Live site: bundle hash changed, all 81 tests pass

---

## Out of scope (deferred to v50+)

- Refactor PootBox.tsx (1,412 lines)
- Offline support (SW caches the bundle)
- Keyboard accessibility
- Error boundary
- Export recordings
- Public launch checklist (Play Store, PWA manifest polish, SEO meta, OG, favicons)
- iOS Safari swipe-back fix
