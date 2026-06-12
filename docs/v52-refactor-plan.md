# PootBox refactor — 1361 lines → ~300

**Date:** 2026-06-11
**Status:** ready to execute
**Goal:** PootBox.tsx is 1,361 lines, 30+ useState hooks, 15+ useRef, 12+ useEffects, 25+ useCallbacks. The single function owns data loading, IDB persistence, physics, audio, recording, mic permission, drag/drop, tap detection, combo system, onboarding, share codes, settings, modals, toasts, ripples, sparks, confetti, bubble spawn, page CRUD, recording flow, mic permission flow. Adding a feature means changing 6 places. This refactor extracts the concerns.

**Pattern:** custom hooks for stateful logic + small subcomponents for render sections. The main `PootBox` becomes a flat composition: it picks the right hooks, composes the right children, and does no business logic itself.

---

## Vision

After the refactor, `PootBox.tsx` should be **~300 lines** that read like a recipe:

```tsx
export default function PootBox() {
  const { pages, activePageId, ...pageActions } = usePagesState()
  const { bubbles, bubbleActions } = useCanvasState(pages, activePageId)
  const { physics } = usePhysicsLoop(bubbles, size)
  const recording = useRecording()
  const { showLibrary, showSettings, ...openModal, closeModal } = useModalState()
  const { onTap, onDrag, onBlank } = useCanvasHandlers(...)
  const { settings, setVolume, setReducedMotion } = useSettings()
  const { showToast, toastMessage } = useToast()
  const { shareCode, setShareCode, showShare, openShare, openLookup, addAsPage } = useShareSheet()

  return (
    <PootBoxCanvas size={size} onBlankPointerDown={onBlank}>
      <FirstRunIntro show={...} onDone={...} />
      <TopBar ... />
      <HomeCategoryChips ... />
      <BubbleCanvas bubbles={physics.bubbles} handlers={...} />
      <AddSoundMenu ... />
      <RecordSheet ... />
      <SoundLibrary ... />
      <SettingsModal ... />
      <ShareSheet ... />
      <VolumeSlider ... />
      <OnboardingHint show={...} />
      <EffectOverlays ripples={...} sparks={...} />
      <FooterBar installBanner={...} updateBanner={...} />
      <Toast message={toastMessage} />
    </PootBoxCanvas>
  )
}
```

That's the target shape. The render is flat and obvious. The state lives in hooks. The components take props, do one thing.

---

## The 8 hooks to extract (each is one concern)

### H1. `usePagesState()` — page CRUD + IDB persistence
**Owns:** `pages`, `activePageId`, `homeCategory`, `savePagesDebounced`
**Exposes:** `{ pages, activePageId, setActivePageId, homeCategory, setHomeCategory, addPage, removePage, renamePage, deletePage, addBubbleToActivePage, removeBubbleFromActivePage, saveAll }`
**File:** `src/pootbox/hooks/usePagesState.ts`
**Lines from PootBox:** ~250 lines (the whole page CRUD + IDB sync)

### H2. `useCanvasState(pages, activePageId)` — bubbles + sync
**Owns:** `bubbles` (state), `bubblesRef` (physics target), the "sync bubblesRef when active page changes" useEffect, `pressedId`, `showPlayedFor`
**Exposes:** `{ bubbles, pressedId, showPlayedFor, getBubbleById, markPressed, clearPressed, markPlayedFor, spawnPositionsFor }`
**File:** `src/pootbox/hooks/useCanvasState.ts`
**Lines from PootBox:** ~100 lines

### H3. `usePhysicsLoop(bubbles, size, settings)` — the raf tick
**Owns:** `rafRef`, `lastFrameRef`, `lastDriftNudgeAtRef`, `collisionCooldownRef`, the raf tick, `setBubbles` per-frame
**Exposes:** `{ setBubbles, sparks, ripples, comboCount, comboBurst, confettiBurst, confettiParticles, lifetimeTapsRef }`
**File:** `src/pootbox/hooks/usePhysicsLoop.ts`
**Lines from PootBox:** ~150 lines
**Key change:** the raf loop moves to a `useEffect` here, fully self-contained. It reads `bubblesRef` (provided by H2) and mutates positions + emits collision events. The hook owns the "callbacks fire on collision" pattern (ripples, sparks, audio, combos).

### H4. `useRecording()` — mic, recorder, MediaRecorder flow
**Owns:** `recPhase`, `pendingBlob`, `pendingUrl`, `recordingMs`, `mediaRecorderRef`, `mediaChunksRef`, `mediaStreamRef`, `recordingTimerRef`, `recordingStartRef`, `micPermState`, `micDenied`
**Exposes:** `{ recPhase, recordingMs, micDenied, startRecording, stopRecording, cancelRecording, finalizeRecording, pickEmoji }`
**File:** `src/pootbox/hooks/useRecording.ts`
**Lines from PootBox:** ~200 lines (the whole mic + MediaRecorder chain)

### H5. `useCanvasHandlers(pages, activePageId, bubblesRef, settings, onBubbleChange)` — pointer events
**Owns:** `dragRef`, `blankHoldTimer`, `blankHoldStartPos`, `lastShakeAtRef`, `shakeCountRef`, `shakeWindowTimerRef`, all the `onBubblePointerDown/Move/Up/Cancel` and `onBlankPointerDown/Move/Up` handlers
**Exposes:** `{ onBubblePointerDown, onBubblePointerMove, onBubblePointerUp, onBubblePointerCancel, onBlankPointerDown, onBlankPointerMove, onBlankPointerUp }`
**File:** `src/pootbox/hooks/useCanvasHandlers.ts`
**Lines from PootBox:** ~250 lines (the entire pointer + drag + shake + hold-to-settings chain)

### H6. `useSettings()` — volume + reduced motion + localStorage
**Owns:** `settings`, `settingsRef`, the `useEffect` to sync settingsRef
**Exposes:** `{ settings, setSettings, setVolume, setReducedMotion }`
**File:** `src/pootbox/hooks/useSettings.ts`
**Lines from PootBox:** ~30 lines

### H7. `useModalState()` — which modal is open
**Owns:** `showLibrary`, `showSettings`, `showVolume`, `showShare`, `showAddMenu`, `showFirstRun`
**Exposes:** `{ showLibrary, showSettings, showVolume, showShare, showAddMenu, showFirstRun, openLibrary, openSettings, openVolume, openShare, openLookup, openAddMenu, closeAll, setShowFirstRun }`
**File:** `src/pootbox/hooks/useModalState.ts`
**Lines from PootBox:** ~20 lines (just state + setters, but cleans up the "what's open" mental model)

### H8. `useToast()` — temporary messages
**Owns:** `toast`, `showToast` (with 1.5s timeout)
**Exposes:** `{ toastMessage, showToast }`
**File:** `src/pootbox/hooks/useToast.ts`
**Lines from PootBox:** ~15 lines

---

## The 3 subcomponents to extract (each is a render section)

### C1. `<EffectOverlays>` — ripples + sparks + combo + confetti
**Takes:** `{ ripples, sparks, comboBurst, confettiBurst, confettiParticles }`
**Renders:** the existing inline `RippleView` / `SparkView` / combo burst / confetti
**File:** `src/pootbox/components/EffectOverlays.tsx`
**Lines from PootBox:** ~80 lines (the multiple inline ripple/spark/burst loops at the bottom of return)

### C2. `<HomeCategoryChips>` — the 4 chips
**Takes:** `{ activePageId, homeCategory, onChange }`
**Renders:** the sticky chip row
**File:** `src/pootbox/components/HomeCategoryChips.tsx`
**Lines from PootBox:** ~70 lines (the chip row JSX)

### C3. `<PootBoxCanvas>` — the outer fixed canvas with size measurement
**Takes:** `{ children }`
**Renders:** the `<div ref={canvasRef}>` with the size measurement useLayoutEffect
**File:** `src/pootbox/components/PootBoxCanvas.tsx`
**Lines from PootBox:** ~25 lines

---

## The main `PootBox.tsx` after refactor

After all 8 hooks and 3 components are extracted, the main PootBox.tsx becomes:

- **~50 lines of state composition** (call the 8 hooks)
- **~200 lines of JSX** (composed top-down: canvas wrapper → overlays → footer → first-run → top bar → chips → bubbles → menus → sheets → modals)
- **Total: ~300 lines, no business logic**

---

## Build steps (one commit per phase)

```
v52-1: extract useSettings + useToast + useModalState (small, low-risk)
v52-2: extract usePagesState (page CRUD + IDB, ~250 lines)
v52-3: extract useCanvasState (bubbles + sync, ~100 lines)
v52-4: extract useRecording (mic + MediaRecorder, ~200 lines)
v52-5: extract useCanvasHandlers (pointer + drag + shake, ~250 lines)
v52-6: extract usePhysicsLoop (raf tick + collision effects, ~150 lines)
v52-7: extract 3 subcomponents (EffectOverlays, HomeCategoryChips, PootBoxCanvas)
v52-8: PootBox.tsx is now ~300 lines of composition only
v52-deploy: redeploy + verify
```

**Build gates (each commit):**
- `npm run build` clean
- `npm run lint` 0 errors
- `npm test` 72+ pass (no new tests — this is pure refactor)
- App still works end-to-end: bubbles load, can tap, drag, record, share, settings, etc.

**Verification (after v52-deploy):**
- [ ] PootBox.tsx is 250-400 lines
- [ ] Hooks/ directory has 8 files
- [ ] Components/ directory has the new EffectOverlays, HomeCategoryChips, PootBoxCanvas
- [ ] All 12 bubbles still spawn within the viewport
- [ ] Tap → sound + squish works
- [ ] Drag → physics + persistence works
- [ ] Recording flow (3 steps) works
- [ ] Share code generate + lookup works
- [ ] Settings modal opens, shows Privacy + About + Show welcome again
- [ ] No console errors
- [ ] No behavioral change visible to the user

---

## Risk register

| Risk | Mitigation |
|---|---|
| Stale closures when extracting handlers | Use refs for cross-callback state (dragRef, blankHoldTimer), pass only stable callbacks down. The existing code already uses refs for these — preserving that pattern. |
| Physics loop reads stale bubbles | The raf loop reads `bubblesRef.current` (mutated by physics), not `state.bubbles`. Don't change the "raf reads ref, setBubbles re-renders" pattern. |
| IDB state machine breaks if page CRUD is split wrong | The page CRUD is mostly pure-function helpers already (deletePagePure, addBubbleToPageDedup). The hook just wraps state around them. Verify with the existing 53+ tests. |
| Recording flow refactor breaks mic permission | The MediaRecorder code is already self-contained. Move the whole `useRecording` block as a unit. |
| Cross-hook dependencies cause infinite loops | H2 (canvas state) depends on pages+activePageId. H3 (physics) depends on bubblesRef. H5 (handlers) depends on bubblesRef + settings + onBubbleChange. H1 is independent. No circular deps. |
| Bigger refactor = bigger blast radius | This is why I'm doing it in 8 small commits instead of one. Each commit must pass build + lint + test before the next. |

---

## What stays the same

- All 30 built-in sounds, the multi-page model, the 12 default animal bubbles
- All components: BubbleCanvas, EmojiBubble, AddSoundMenu, RecordSheet, SoundLibrary, ShareSheet, SettingsModal, VolumeSlider, FirstRunIntro, OnboardingHint, PageTabs, TopBar, FooterBar, InstallPrompt, UpdatePrompt, EmptyPageHint
- All hooks behavior
- All IDB schemas
- All physics
- All CSS / styling (untouched)
- All localStorage keys
- All public API (no breaking changes — this is internal)
- All tests

**Zero user-visible change. Just better-organized code.**
