# Plan: animal-farts v56 — "make it a proper web game"

State: HEAD at `941c53c` (v55 corner-fling fix + sync-caddy resilience). Live site
healthy. 92 tests, 81 pass + 11 pre-existing skipped. Build clean, 255.57 kB bundle.
PootBox.tsx is 720 lines (down from 1361 in v52). All 8 hooks extracted.

This plan integrates two sources:
- The 2026-06-12 "PootBox code review" (session 20260612_092707_e4d43dc1) —
  the original review that found the shake-to-stop gap, the per-bubble
  debounce, and the offline share lookup.
- The 2026-06-13 v55 work — the corner-fling fix landed in f48b0d6, deploy
  resilience in 941c53c.

The review's 4 open items are still valid. The corner-fling fix closed the
"all bubbles go to the corner" symptom, but the underlying request — "make
this a proper web game" — needs more.

## Priorities

### v56-1 — Shake-to-stop (1-2 hour, low risk, high perceived quality)

The shake handler at PootBox.tsx:172 currently only opens Settings on 3
shakes. The useCanvasHandlers version (line 240) detects shake but does
nothing (commented "PootBox will wire this via a separate ref or a callback").
The user-facing intent is: shake the device → all sounds stop, like a
"panic button" for a kid whose emoji chaos got out of hand.

Fix:
- Add `stopAllSounds(); setSoundPlaying(false);` to the shake handler's
  `if (shakeCountRef.current >= 3)` branch (right after the existing
  `setShowSettings(true)` — keep the settings open so parents can also
  see what happened, but silence the chaos).
- Remove the dead shake handler in useCanvasHandlers.ts (line 240). It
  has no UI to wire to and just confuses the code.
- Reduce shake threshold from 22 to 18 in PootBox (the useCanvasHandlers
  version was already 18; the 22 was an early tweak that's now too
  sensitive for a kids' device).
- Add a brief UI flash: when shake fires, show a transient "🛑 Shaken!"
  toast for 1.2s. Reuse the existing `useToast` hook.

Why this matters: the visible ⏹ button is a fallback for parents. The
shake-to-stop is the kid's natural gesture. Until this works, the app
feels less responsive than it should.

### v56-2 — Tap-spam on the same bubble (30 min, low risk, big perceived UX)

playFromBubble at PootBox.tsx:275 has a 250ms per-bubble debounce. So
mashing the same emoji quickly only plays one sound. The kid expects to
be able to spam.

Fix:
- Drop the per-bubble debounce entirely. The single-voice policy in
  audioManager.ts (clear active set, then play the new one) already
  prevents overlapping sounds. The 250ms gate was redundant.
- Add `navigator.vibrate(20)` in playFromBubble (1 line). Makes taps feel
  responsive on devices that support it.
- Drop the now-unused `lastCirclePlayRef` Map and its `now` lookup.

Why this matters: kids will mash. The current gate makes the second tap
feel broken. Dropping it makes the app feel snappy.

### v56-3 — Share-sheet offline detection (30 min, low risk, low visibility)

PootBox.tsx:497 catches the fetch error and returns null silently. The
share sheet then shows nothing and the kid is confused.

Fix (5 lines):
```ts
onLookupCode={async (code) => {
  if (!navigator.onLine) return { __offline: true, code };
  try {
    const r = await fetch(`/api/share/${code}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}}
```

Then in ShareSheet.tsx: when `data.__offline` is true, show "You're
offline — share codes need internet to look up. Try the code you
already used." instead of the silent failure.

Bonus: cache the last 3 successful lookups in localStorage so the kid
can re-import a recent code even while offline.

### v56-4 — Visual stop-target on the playing bubble (1 hour, medium risk)

The visible ⏹ button is in the corner. If the kid has 12 bubbles in
motion, they may not look at the corner. Make the currently-playing
bubble the stop target too: tap the playing bubble → sound stops. The
single-voice policy already handles the "stop the playing sound when
you tap another" case, but "stop the playing sound when you tap the
same one again" doesn't work today.

This is the "make it a proper game" line item. A subtle but real UX
improvement. It also enables a future: every bubble is its own stop
button, not just the ⏹.

### v56-5 — Share-import blobUrl persistence (1-2 hours, medium risk)

PootBox.tsx:508 stores `data.audioUrl` as both `blobUrl` and `sound` on
the imported bubble. If the bubble is reloaded from IDB, the blobUrl is
gone (IDB holds `sound: data.audioUrl` but `data.audioUrl` was a one-shot
blob: URL). The bubble goes silent on reload.

Fix: when the share endpoint returns an `audioUrl`, fetch it and store the
bytes in IDB as a Blob (IndexedDB can hold Blobs). On reload, rehydrate
the blobUrl from the stored Blob. ~50 lines + a test.

Defer to v57 if v56 budget runs tight. The bug is real but not user-
facing unless the kid reloads after sharing.

## Out of scope for v56 (next 3 months of work)

- **Score / levels / leaderboard** — needs a backend, a schema, and a
  design conversation with Cam about what "winning" means in a soundboard.
  Defer to a separate spec.
- **Emoji library expansion** — easy (just add to BUILT_IN_SOUNDS in
  constants.ts), but no real "game" payoff. The 16 current sounds are
  plenty for the kid audience. Defer until Cam has specific asks.
- **Settings redesign** — the modal at /settings is a wall of switches.
  A grouped UI (Sound / Privacy / About / Debug) would be nicer but
  takes a few hours. Defer.
- **Long-press = delete** — currently 5s blank-canvas long-press opens
  Settings. A 1s bubble long-press could open "delete / change sound"
  menu for that bubble. Cool but adds gesture complexity. Defer.

## Sequence

The first 3 items (v56-1 to v56-3) are each < 1 hour, isolated changes,
and address the user-facing "proper game" framing. Land them in one
commit cluster. Then v56-4 and v56-5 are the deeper refactors.

Suggested commit order:
1. v56-1: shake-to-stop (touch useCanvasHandlers, PootBox, test)
2. v56-2: drop the 250ms debounce + vibrate (touch playFromBubble,
   audioManager, test)
3. v56-3: offline detection (touch PootBox, ShareSheet, test)
4. v56-4: tap-playing-bubble-to-stop (touch CanvasHandlers, audioManager,
   new prop, test)
5. v56-5: blobUrl persistence (touch usePagesState, IDB schema migration,
   test)

Each commit stands alone and can be reverted without breaking the others.

## Total scope

~5-6 hours of work, 5 commits, ~200 lines of code, ~80 lines of tests.
Live site gets the changes within 2 deploy cycles (each v56 commit
ships individually via `scripts/deploy-vps.sh`).
