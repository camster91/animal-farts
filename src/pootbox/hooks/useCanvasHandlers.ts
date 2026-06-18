// useCanvasHandlers.ts — v72: trimmed to just the 5-second blank-canvas
// long-press that opens Settings. The v52-era bubble pointer handlers
// (down/move/up/cancel) and the DragState interface were DEAD as of v61 —
// the CardGrid replaced the physics canvas, so the kid taps a card via
// onClick rather than drag-to-reposition. v52 was the last release
// that used them; v52-5 documented the trim but the code survived.
// v72 deletes the dead code (the unused exports and the 7-field
// DragState) and the comment at PootBox.tsx:392-396 is now accurate.

import { useRef, useCallback } from "react";

export interface UseCanvasHandlersOptions {
  /** Open the settings modal (called after 5s blank-canvas long-press) */
  onSettingsOpen: () => void;
}

export interface UseCanvasHandlersResult {
  onBlankPointerDown: (e: React.PointerEvent) => void;
  onBlankPointerMove: (e: React.PointerEvent) => void;
  onBlankPointerUp: (e: React.PointerEvent) => void;
}

const HOLD_TO_OPEN_SETTINGS_MS = 5000;

export function useCanvasHandlers(opts: UseCanvasHandlersOptions): UseCanvasHandlersResult {
  const { onSettingsOpen } = opts;

  const blankHoldTimer = useRef<number | null>(null);
  // blankHoldStartPos tracks the pointer-down position so a 12px+ move
  // cancels the hold (kid is scrolling/dragging the page, not holding
  // for the settings shortcut).
  const blankHoldStartPos = useRef<{ x: number; y: number } | null>(null);

  const onBlankPointerDown = useCallback((e: React.PointerEvent) => {
    blankHoldStartPos.current = { x: e.clientX, y: e.clientY };
    if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
    blankHoldTimer.current = window.setTimeout(() => {
      onSettingsOpen();
      blankHoldTimer.current = null;
    }, HOLD_TO_OPEN_SETTINGS_MS);
  }, [onSettingsOpen]);

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

  const onBlankPointerUp = useCallback(() => {
    if (blankHoldTimer.current) {
      window.clearTimeout(blankHoldTimer.current);
      blankHoldTimer.current = null;
    }
    blankHoldStartPos.current = null;
  }, []);

  return {
    onBlankPointerDown,
    onBlankPointerMove,
    onBlankPointerUp,
  };
}
