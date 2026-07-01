// usePhysicsLoop.ts — v80: the raf physics tick is REMOVED.
//
// History:
//   v52-6 — extracted raf loop + collision detection from PootBox.
//   v61   — CardGrid replaced the physics canvas with a static
//            grid. The raf tick kept running but its setBubbles
//            write was a no-op (the parent passes a setter that
//            discards), so it was dead code for the bubble motion.
//            But onCollisionSound still fired on every collision.
//   v72   — Code review flagged the dead write but didn't kill
//            the loop itself. ~3,000 lines of physics code kept
//            running in production.
//   v80   — User reports "None of the buttons seem to work" —
//            investigation via headless Chromium shows the loop
//            is creating 1000+ HTMLAudioElement instances in 5
//            seconds on first load, hitting Chromium's
//            WebMediaPlayer limit, silently breaking all kid
//            audio. Root cause: the default page creates 30
//            bubbles (BUILT_IN_SOUNDS) at position (0, 0) — all
//            overlapping. stepPhysics() returns collisions for
//            every pair every frame; userDriven sometimes flips
//            true via first-tap, the audio system creates a new
//            <audio> per collision, and the browser chokes.
//
// This v80 file keeps the hook's PUBLIC API (comboBurst,
// confettiBurst, triggerComboBurst, triggerConfetti, ripples)
// so PootBox callers don't break, but the raf tick is gone.
// The audio system is now driven solely by audioManager.ts
// (called from PootBox's handleBubbleTap on each card click).
// The visual effects (ripples, sparks, confetti) are also
// dormant — CardGrid doesn't bubble events. They're kept as
// state hooks so the React tree doesn't break, but no events
// are emitted.

import { useState, useEffect, useRef, useCallback } from "react";
import type { Ripple, Spark, Settings } from "../types";
import { isAnySoundPlaying, getCurrentBubbleId } from "../audioManager";

export interface UsePhysicsLoopParams {
  bubblesRef: React.RefObject<unknown[]>;
  setBubbles: (b: unknown[]) => void;
  size: { w: number; h: number };
  settingsRef: React.RefObject<Settings>;
  /** Kept for API compatibility but no longer called — the
   *  physics tick that would call this is gone. */
  onCollisionSound: (b: unknown, volume: number) => void;
}

export interface UsePhysicsLoopResult {
  ripples: Ripple[];
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>;
  sparks: Spark[];
  comboBurst: { x: number; y: number; n: number; particles: { dx: number; dy: number }[] } | null;
  confettiBurst: number;
  confettiParticles: { dx: number; dy: number; color: string }[];

  // Combo + confetti triggers (kept for API compat — PootBox calls
  // these on tap, they fire a visual effect). Without the physics
  // tick the visual effect isn't connected to anything, but the
  // setters are still safe to call.
  triggerComboBurst: (x: number, y: number, n: number) => void;
  triggerConfetti: () => void;
}

const CONFETTI_PARTICLE_COUNT = 24;
const CONFETTI_LIFETIME_MS = 1200;

export function usePhysicsLoop(params: UsePhysicsLoopParams): UsePhysicsLoopResult {
  const { bubblesRef, setBubbles, size, settingsRef, onCollisionSound } = params;

  // ── Visual effect state (kept for API compat) ──────────────────────
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [comboBurst, setComboBurst] = useState<{ x: number; y: number; n: number; particles: { dx: number; dy: number }[] } | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [confettiParticles, setConfettiParticles] = useState<{ dx: number; dy: number; color: string }[]>([]);

  // Suppress unused warnings on parameters kept for API compat
  void bubblesRef;
  void setBubbles;
  void settingsRef;
  void onCollisionSound;

  // ── Combo + confetti triggers ──────────────────────────────────────
  const comboBurstTimeoutRef = useRef<number | null>(null);

  const triggerComboBurst = useCallback((x: number, y: number, n: number) => {
    const particles = Array.from({ length: 8 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 30;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
    });
    setComboBurst({ x, y, n, particles });
    if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
    comboBurstTimeoutRef.current = window.setTimeout(() => setComboBurst(null), 700);
  }, []);

  const triggerConfetti = useCallback(() => {
    const colors = ["#FF5252", "#FFD740", "#69F0AE", "#40C4FF", "#B388FF"];
    const particles = Array.from({ length: CONFETTI_PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 5;
      return {
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    setConfettiBurst(c => c + 1);
    setConfettiParticles(particles);
    setTimeout(() => setConfettiParticles([]), CONFETTI_LIFETIME_MS);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
    };
  }, []);

  // Sparks is part of the public API (CanvasEffects reads it) but
  // the raf tick that populated it is gone. Return an empty array
  // — no sparks will ever render until the visual layer is
  // rewired.
  const sparks: Spark[] = [];

  // Suppress unused warnings on the size dep that the noop
  // tick used to depend on
  void size;

  return {
    ripples,
    setRipples,
    sparks,
    comboBurst,
    confettiBurst,
    confettiParticles,
    triggerComboBurst,
    triggerConfetti,
  };
}

/**
 * useSoundPlaying — polls audioManager for the playing state.
 * Extracted from PootBox in v52-6. Returns a 3-tuple so the
 * tap handler can detect "tap the playing bubble".
 *
 * v80: this hook is independent of the raf physics tick that
 * used to call it. The poll alone is still useful for the
 * playing-state UI (the CardGrid's "playing" pulse animation).
 */
export function useSoundPlaying(): [boolean, (playing: boolean) => void, string | null] {
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [currentBubbleId, setCurrentBubbleId] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSoundPlaying(isAnySoundPlaying());
      setCurrentBubbleId(getCurrentBubbleId());
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  return [soundPlaying, setSoundPlaying, currentBubbleId];
}