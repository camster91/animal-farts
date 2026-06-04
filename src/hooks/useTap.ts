// useTap — distinguishes a real tap from a swipe/long-press.
// On iOS Safari, `onPointerDown` fires the moment a finger lands on a
// button, even if the user is starting a scroll. Without this hook,
// scrolling past an animal card plays the sound.
//
// We record (x, y, t, pointerId) on pointerdown. On pointerup (or
// pointercancel/pointerleave), we fire the callback ONLY if the pointer
// moved less than `threshold` pixels AND less than `maxMs` milliseconds
// elapsed. Otherwise it's a swipe / drag / long-press, and the callback
// is suppressed.
//
// Mouse input is never gated — desktop clicks are always taps.

import { useRef, useCallback, useMemo, type PointerEvent as RPointerEvent } from "react";

export type TapEvent = { x: number; y: number };
type TapHandler = (e: TapEvent) => void;

export type UseTapOptions = {
  threshold?: number; // px movement allowed before it's a swipe
  maxMs?: number;     // ms elapsed before it's a long-press
  enabled?: boolean;  // set to false to disable the listener entirely
};

export function useTap(handler: TapHandler, opts: UseTapOptions = {}) {
  const threshold = opts.threshold ?? 10;
  const maxMs = opts.maxMs ?? 500;
  const enabled = opts.enabled ?? true;

  // Always read the latest handler so we don't re-attach on every render
  const handlerRef = useRef<TapHandler>(handler);
  handlerRef.current = handler;

  const startRef = useRef<{ x: number; y: number; t: number; id: number; isTouch: boolean } | null>(null);

  const onPointerDown = useCallback((e: RPointerEvent<HTMLElement>) => {
    if (!enabled) return;
    // Mouse never has the scroll-fire ambiguity
    if (e.pointerType === "mouse") {
      startRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, isTouch: false };
      return;
    }
    // Touch + pen: record
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, isTouch: true };
  }, [enabled]);

  const finish = useCallback((e: RPointerEvent<HTMLElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || e.pointerId !== start.id) return;
    if (!start.isTouch) {
      // Mouse — always fire
      handlerRef.current({ x: e.clientX, y: e.clientY });
      return;
    }
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > threshold) return; // swipe, not tap
    const dt = Date.now() - start.t;
    if (dt > maxMs) return; // long press, not tap
    handlerRef.current({ x: e.clientX, y: e.clientY });
  }, [threshold, maxMs]);

  // Bind onPointerDown + onPointerUp + onPointerCancel + onPointerLeave
  return useMemo(() => ({
    onPointerDown,
    onPointerUp: finish,
    onPointerCancel: finish,
    onPointerLeave: finish,
  }), [onPointerDown, finish]);
}
