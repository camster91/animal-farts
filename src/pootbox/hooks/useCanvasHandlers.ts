// useCanvasHandlers.ts — extracted from PootBox.tsx in v52-5
// Owns: dragRef, blankHoldTimer, blankHoldStartPos, all 7 pointer handlers,
// tap-to-delete + tap-to-play + drag-to-reposition gestures on bubbles.
//
// Bugs fixed in v55 (this commit):
//   1. DOUBLE VELOCITY CONVERSION (the "all bubbles fly to the corner"
//      bug). Previously the move handler stored
//        drag.velocity = { x: dx / dt * 16.67, y: dy / dt * 16.67 }
//      (px/ms × 16.67ms/frame = px/frame), and the up handler did
//        b.vel = drag.velocity * 16.67
//      again, so the integrated velocity was ~278× too high. A real
//      100px/100ms drag produced a 16.67×16.67 = 278 px/frame velocity.
//      The bubble was off-screen in one frame, the wall-clamp physics
//      yanked it to (radius, radius) = the upper-left corner, and
//      friction settled it there. Removing the redundant
//      * 16.67 on release fixes it; drag.velocity is already in
//      px/frame.
//   2. TAP DETECTION USED LAST-MOVE POSITION, NOT DOWN POSITION.
//      Previously
//        const totalDist = sqrt((e.clientX - drag.lastX)^2 + ...);
//      but drag.lastX/Y is updated on every pointermove. So a slow
//      drag with a pause before release registered as ~0 distance
//      (a false "tap") and a fast tap with a tiny move registered as
//      the small move distance. Now we track startX/startY in the
//      DragState and use those.
//   3. DOUBLE TAP CALL — the built-in-bubble tap branch fired both
//      onBubbleTap?.() (legacy) AND handleBubbleTap() (current).
//      Removed the legacy call.
//
// Why we also track the down timestamp (downT): for future
// long-press detection (currently we only support short tap, drag, and
// tap-to-delete — no long-press menu yet).
// Shake detection lives in PootBox (it owns the "open settings + nudge bubbles"
// behavior); an earlier devicemotion listener here was dead code, removed in v53.

import { useRef, useCallback } from "react";
import type { Page, BubbleState, Vec2 } from "../types";

// ─── Drag state shape ─────────────────────────────────────────────────────────

interface DragState {
  id: string;
  /** Pointer-down position (used for accurate tap detection on up) */
  startX: number;
  startY: number;
  /** Most recent pointermove position (used for delta calculation) */
  lastX: number;
  lastY: number;
  /** Most recent pointermove timestamp (ms) — for velocity calculation */
  lastT: number;
  /** Pointer-down timestamp (ms) — for future long-press detection */
  downT: number;
  /** Velocity in px/frame, set by move handler, applied by up handler */
  velocity: Vec2;
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface UseCanvasHandlersOptions {
  /** For computing bubble position from client coords (reserved for future use) */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Mutable ref to bubbles — written by physics loop, read by handlers */
  bubblesRef: React.MutableRefObject<BubbleState[]>;
  /** Active page id — needed to persist bubble positions on drag end */
  activePageId: string | null;
  /** Update pages state (used by onBubblePointerUp to sync position) */
  setPages: (updater: (prev: Page[]) => Page[]) => void;
  /** Remove a bubble (custom: also clean up blob; built-in: just page) */
  onRemoveBubble: (id: string) => void;
  /** Persist page changes to IDB */
  savePagesDebounced: (pages: Page[]) => void;
  /** Called on a real tap (drag movement < 8px) — for combo / lifetime / onboarding.
   *  Lives in PootBox (not in this hook) because it depends on combo / lifetime
   *  state that lives next to the bubble render tree. */
  onBubbleTap: (id: string, clientX: number, clientY: number) => void;
  /** Open the settings modal (called after 5s blank-canvas long-press) */
  onSettingsOpen: () => void;
}

export interface UseCanvasHandlersResult {
  onBubblePointerDown: (id: string, e: React.PointerEvent) => void;
  onBubblePointerMove: (id: string, e: React.PointerEvent) => void;
  onBubblePointerUp: (id: string, e: React.PointerEvent) => void;
  onBubblePointerCancel: (id: string) => void;
  onBlankPointerDown: (e: React.PointerEvent) => void;
  onBlankPointerMove: (e: React.PointerEvent) => void;
  onBlankPointerUp: (e: React.PointerEvent) => void;
}

const HOLD_TO_OPEN_SETTINGS_MS = 5000;
const TAP_DELETE_DISTANCE_PX = 8;     // movement threshold for tap vs drag

export function useCanvasHandlers(opts: UseCanvasHandlersOptions): UseCanvasHandlersResult {
  // canvasRef is provided for potential future use (e.g. coordinate conversion
  // in onBubblePointerUp) but currently the hook uses pointer events directly.
  const {
    bubblesRef, activePageId,
    setPages, onRemoveBubble, savePagesDebounced,
    onBubbleTap, onSettingsOpen,
  } = opts;

  // ─── Gesture refs ─────────────────────────────────────────────────────────

  const dragRef = useRef<DragState | null>(null);
  const blankHoldTimer = useRef<number | null>(null);
  const blankHoldStartPos = useRef<Vec2 | null>(null);

  // ─── Pointer down on a bubble (begin drag) ──────────────────────────────

  const onBubblePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    dragRef.current = {
      id,
      // startX/startY are the ORIGINAL pointer-down position. We need
      // them for accurate tap detection on up (lastX/Y is updated on
      // every move, so using it would mis-classify drags as taps).
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      downT: performance.now(),
      lastT: performance.now(),
      velocity: { x: 0, y: 0 },
    };
    b.lastTouchedAt = performance.now();
  }, [bubblesRef]);

  // ─── Pointer move on a bubble (drag) ───────────────────────────────────

  const onBubblePointerMove = useCallback((id: string, e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 1);
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    b.pos.x += dx;
    b.pos.y += dy;
    // Velocity is stored in px/frame (assuming a 60fps target, 16.67 ms/frame).
    // The up handler applies this DIRECTLY to b.vel — no further
    // ms-to-frame conversion. (Earlier versions double-multiplied by 16.67
    // here and again in the up handler, producing ~278x the intended
    // velocity, which flung bubbles off-screen and the wall-clamp
    // physics caught them at (radius, radius) = the upper-left corner.)
    drag.velocity = { x: dx / dt * 16.67, y: dy / dt * 16.67 };
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = now;
  }, [bubblesRef]);

  // ─── Pointer up on a bubble (release / tap to delete) ───────────────────

  const onBubblePointerUp = useCallback((id: string, e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) {
      dragRef.current = null;
      return;
    }
    // Total distance from the ORIGINAL pointer-down position. Using
    // startX/startY (not lastX/lastY) means a slow drag with a pause
    // before release is correctly classified as a drag, not a tap.
    const totalDist = Math.sqrt(
      Math.pow(e.clientX - drag.startX, 2) + Math.pow(e.clientY - drag.startY, 2)
    );
    if (totalDist < TAP_DELETE_DISTANCE_PX && id.startsWith("b:custom:")) {
      onRemoveBubble(id);
    } else if (totalDist < TAP_DELETE_DISTANCE_PX) {
      // Real tap on a built-in bubble → fire the parent's tap handler
      // (which plays the sound, spawns the ripple, increments combo,
      // dismisses onboarding, etc.). handleBubbleTap is the single
      // source of truth — the v52 refactor accidentally fired both
      // this prop AND a duplicate internal call.
      onBubbleTap(id, e.clientX, e.clientY);
    }
    // Velocity is already in px/frame from the move handler — apply
    // it directly. (Removed the * 16.67 that caused the corner-fling.)
    b.vel.x = drag.velocity.x;
    b.vel.y = drag.velocity.y;
    b.lastTouchedAt = performance.now();
    b.lastReleasedAt = performance.now();
    // Persist position
    setPages(prev => {
      const updated = prev.map(p => {
        if (p.id !== activePageId) return p;
        return {
          ...p,
          bubbles: p.bubbles.map(bb => bb.id === id ? { ...bb, pos: { ...b.pos } } : bb),
        };
      });
      savePagesDebounced(updated);
      return updated;
    });
    dragRef.current = null;
  }, [bubblesRef, activePageId, onBubbleTap, onRemoveBubble, savePagesDebounced, setPages]);

  // ─── Pointer cancel on a bubble (drag aborted) ──────────────────────────

  const onBubblePointerCancel = useCallback((id: string) => {
    if (dragRef.current?.id === id) {
      dragRef.current = null;
    }
  }, []);

  // ─── Pointer down on blank canvas (start 5s hold for settings) ────────

  const onBlankPointerDown = useCallback((_e: React.PointerEvent) => {
    blankHoldStartPos.current = { x: _e.clientX, y: _e.clientY };
    if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
    blankHoldTimer.current = window.setTimeout(() => {
      // Open settings if the pointer is still down
      onSettingsOpen();
      blankHoldTimer.current = null;
    }, HOLD_TO_OPEN_SETTINGS_MS);
  }, [onSettingsOpen]);

  // ─── Pointer move on blank canvas (cancel 5s hold if moved too much) ───

  const onBlankPointerMove = useCallback((e: React.PointerEvent) => {
    if (!blankHoldStartPos.current || !blankHoldTimer.current) return;
    const dx = e.clientX - blankHoldStartPos.current.x;
    const dy = e.clientY - blankHoldStartPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 12) {
      window.clearTimeout(blankHoldTimer.current);
      blankHoldTimer.current = null;
      blankHoldStartPos.current = null;
    }
  }, []);

  // ─── Pointer up on blank canvas (clear 5s hold timer) ──────────────────

  const onBlankPointerUp = useCallback(() => {
    if (blankHoldTimer.current) {
      window.clearTimeout(blankHoldTimer.current);
      blankHoldTimer.current = null;
    }
    blankHoldStartPos.current = null;
  }, []);

  // Shake detection lives in PootBox (it owns the "open settings + nudge
  // bubbles" behavior). An earlier version of this hook had its own
  // devicemotion listener that counted shakes and reset itself without
  // doing anything user-visible. That double-listener + dead-counter was
  // removed — see the v53 code review.

  return {
    onBubblePointerDown,
    onBubblePointerMove,
    onBubblePointerUp,
    onBubblePointerCancel,
    onBlankPointerDown,
    onBlankPointerMove,
    onBlankPointerUp,
  };
}
