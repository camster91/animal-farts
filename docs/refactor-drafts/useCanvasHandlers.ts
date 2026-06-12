/* eslint-disable @typescript-eslint/no-unused-vars */
// useCanvasHandlers.ts — extracted from PootBox.tsx in v52-5
// Owns: dragRef, blankHoldTimer, blankHoldStartPos, lastShakeAtRef, shakeCountRef,
//       shakeWindowTimerRef, shake detection useEffect, all 7 pointer handlers,
//       handleBubbleTap (tap → ripple + sound + combo + lifetime + tap-to-delete).

import { useRef, useCallback, useEffect } from "react";
import type { Page, BubbleState, Vec2, Settings } from "../types";

// ─── Drag state shape ─────────────────────────────────────────────────────────

interface DragState {
  id: string;
  lastX: number;
  lastY: number;
  lastT: number;
  velocity: Vec2;
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface UseCanvasHandlersOptions {
  /** For computing bubble position from client coords */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Mutable ref to bubbles — written by physics loop, read by handlers */
  bubblesRef: React.MutableRefObject<BubbleState[]>;
  /** Current settings (for volume) */
  settingsRef: React.MutableRefObject<Settings>;
  /** Active page id — needed to persist bubble positions on drag end */
  activePageId: string | null;
  /** Show the "played" indicator */
  setShowPlayedFor: (id: string | null) => void;
  /** Update combo count */
  setComboCount: (count: number) => void;
  /** Trigger combo burst effect */
  triggerComboBurst: (x: number, y: number, n: number) => void;
  /** Trigger confetti effect */
  triggerConfetti: () => void;
  /** Increment combo count (returns new count; handles reset internally) */
  incrementCombo: () => number;
  /** Mutable ref for combo count (used to check milestone) */
  _comboCountRef: React.MutableRefObject<number>;
  /** Unlock audio context (must be stable) */
  _unlockAudio: () => void;
  /** Update pages state (used by onBubblePointerUp to sync position) */
  setPages: (updater: (prev: Page[]) => Page[]) => void;
  /** Remove a bubble (custom: also clean up blob; built-in: just page) */
  onRemoveBubble: (id: string) => void;
  /** Persist page changes to IDB */
  savePagesDebounced: (pages: Page[]) => void;
  /** Trigger ripple visual effect */
  onSpawnRipple: (x: number, y: number, color?: string) => void;
  /** Play a sound from a bubble */
  onPlayFromBubble: (b: BubbleState, volume: number) => void;
  /** Open the settings modal */
  onSettingsOpen: () => void;
  /** Dismiss onboarding on first tap */
  onFirstTap: () => void;
}

export interface UseCanvasHandlersResult {
  onBubblePointerDown: (id: string, e: React.PointerEvent) => void;
  onBubblePointerMove: (id: string, e: React.PointerEvent) => void;
  onBubblePointerUp: (id: string, e: React.PointerEvent) => void;
  onBubblePointerCancel: (id: string) => void;
  onBlankPointerDown: (e: React.PointerEvent) => void;
  onBlankPointerMove: (e: React.PointerEvent) => void;
  onBlankPointerUp: (e: React.PointerEvent) => void;
  /** Cleanup — call from PootBox useEffect return */
  cleanup: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCanvasHandlers({
  canvasRef,
  bubblesRef,
  settingsRef,
  activePageId,
  setShowPlayedFor,
  setComboCount,
  triggerComboBurst,
  triggerConfetti,
  incrementCombo,
  _comboCountRef,
  _unlockAudio,
  setPages,
  onRemoveBubble,
  savePagesDebounced,
  onSpawnRipple,
  onPlayFromBubble,
  onSettingsOpen,
  onFirstTap,
}: UseCanvasHandlersOptions): UseCanvasHandlersResult {
  // ── Gesture refs ───────────────────────────────────────────────────────────

  const dragRef = useRef<DragState | null>(null);
  const blankHoldTimer = useRef<number | null>(null);
  const blankHoldStartPos = useRef<Vec2 | null>(null);

  // Shake detection
  const lastShakeAtRef = useRef(0);
  const shakeCountRef = useRef(0);
  const shakeWindowTimerRef = useRef<number | null>(null);

  // ── Internal tap-tracking refs ────────────────────────────────────────────

  const _lastTapAtRef = useRef(0);
  const _lifetimeTapsRef = useRef(0);
  const comboResetTimerRef = useRef<number | null>(null);

  // ── handleBubbleTap ─────────────────────────────────────────────────────────
  // Orchestrates: ripple + sound + played indicator + combo + lifetime + onboarding.

  const handleBubbleTap = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const b = bubblesRef.current.find(x => x.id === id);
      if (!b) return;
      const now = performance.now();
      b.lastTouchedAt = now;

      onPlayFromBubble(b, settingsRef.current.volume);
      onSpawnRipple(clientX, clientY);

      // Show played indicator
      setShowPlayedFor(id);
      setTimeout(() => setShowPlayedFor(null), 800);

      // Combo: incrementCombo handles setComboCount, 800ms reset, and lifetime confetti
      const newCombo = incrementCombo();

      // Combo burst at milestones (every 5 taps)
      if (newCombo % 5 === 0) {
        triggerComboBurst(clientX, clientY, newCombo);
      }

      // Dismiss onboarding on first tap
      onFirstTap();
    },
    [bubblesRef, settingsRef, onPlayFromBubble, onSpawnRipple, setShowPlayedFor, incrementCombo, triggerComboBurst, onFirstTap],
  );

  // ── Bubble pointer handlers ────────────────────────────────────────────────

  const onBubblePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      if (target.setPointerCapture && e.pointerId !== undefined) {
        try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }

      handleBubbleTap(id, e.clientX, e.clientY);

      const b = bubblesRef.current.find(x => x.id === id);
      if (b) { b.vel.x = 0; b.vel.y = 0; }

      dragRef.current = {
        id,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: { x: 0, y: 0 },
      };
    },
    [handleBubbleTap, bubblesRef],
  );

  const onBubblePointerMove = useCallback(
    (id: string, e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id) return;
      const b = bubblesRef.current.find(x => x.id === id);
      if (!b) return;
      const now = performance.now();
      b.lastTouchedAt = now;
      const dt = now - drag.lastT;
      if (dt > 0) {
        const instVx = (e.clientX - drag.lastX) / dt;
        const instVy = (e.clientY - drag.lastY) / dt;
        drag.velocity.x = drag.velocity.x * 0.6 + instVx * 0.4;
        drag.velocity.y = drag.velocity.y * 0.6 + instVy * 0.4;
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      b.pos.x = e.clientX - rect.left;
      b.pos.y = e.clientY - rect.top;
    },
    [canvasRef, bubblesRef],
  );

  const onBubblePointerUp = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const drag = dragRef.current;
      if (drag && drag.id === id) {
        const b = bubblesRef.current.find(x => x.id === id);
        if (b) {
          // Short tap = show delete for custom bubbles
          const totalDist = Math.sqrt((e.clientX - drag.lastX) ** 2 + (e.clientY - drag.lastY) ** 2);
          if (totalDist < 8 && id.startsWith("b:custom:")) {
            onRemoveBubble(id);
          }
          b.vel.x = drag.velocity.x * 16.67;
          b.vel.y = drag.velocity.y * 16.67;
          b.lastTouchedAt = performance.now();
          b.lastReleasedAt = performance.now();
          // Persist position
          if (activePageId) {
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
          }
        }
        dragRef.current = null;
      }
    },
    [activePageId, bubblesRef, onRemoveBubble, savePagesDebounced, setPages],
  );

  const onBubblePointerCancel = useCallback(
    (id: string) => {
      if (dragRef.current?.id === id) {
        const b = bubblesRef.current.find(x => x.id === id);
        if (b) b.lastTouchedAt = performance.now();
        dragRef.current = null;
      }
    },
    [bubblesRef],
  );

  // ── Blank area pointer handlers ─────────────────────────────────────────────

  const onBlankPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      blankHoldStartPos.current = { x: e.clientX, y: e.clientY };
      if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
      blankHoldTimer.current = window.setTimeout(() => {
        onSettingsOpen();
        blankHoldTimer.current = null;
      }, 5000);
    },
    [onSettingsOpen],
  );

  const onBlankPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!blankHoldStartPos.current) return;
      const dx = Math.abs(e.clientX - blankHoldStartPos.current.x);
      const dy = Math.abs(e.clientY - blankHoldStartPos.current.y);
      if (dx > 25 || dy > 25) {
        if (blankHoldTimer.current) { window.clearTimeout(blankHoldTimer.current); blankHoldTimer.current = null; }
        blankHoldStartPos.current = null;
      }
    },
    [],
  );

  const onBlankPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (blankHoldTimer.current) { window.clearTimeout(blankHoldTimer.current); blankHoldTimer.current = null; }
      blankHoldStartPos.current = null;
    },
    [],
  );

  // ── Shake detection ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > 22) {
        const now = Date.now();
        if (now - lastShakeAtRef.current > 1000) {
          shakeCountRef.current = 0;
          lastShakeAtRef.current = now;
        }
        shakeCountRef.current++;
        lastShakeAtRef.current = now;
        if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
        shakeWindowTimerRef.current = window.setTimeout(() => { shakeCountRef.current = 0; }, 2000);
        if (shakeCountRef.current >= 3) {
          onSettingsOpen();
          shakeCountRef.current = 0;
          // Nudge all bubbles
          for (const b of bubblesRef.current) {
            b.vel.x += (Math.random() - 0.5) * 5;
            b.vel.y += (Math.random() - 0.5) * 5;
            b.lastTouchedAt = now;
          }
        }
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [bubblesRef, onSettingsOpen]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
    if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
    if (comboResetTimerRef.current) window.clearTimeout(comboResetTimerRef.current);
  }, []);

  return {
    onBubblePointerDown,
    onBubblePointerMove,
    onBubblePointerUp,
    onBubblePointerCancel,
    onBlankPointerDown,
    onBlankPointerMove,
    onBlankPointerUp,
    cleanup,
  };
}