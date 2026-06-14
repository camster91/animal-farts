// usePhysicsLoop.ts — extracted from PootBox.tsx in v52-6
// Owns: the raf tick, bubble physics step, collision events (ripples, sparks, audio
// on user-driven collision), soundPlaying poll, comboBurst + confettiBurst + confettiParticles.

import { useState, useEffect, useRef, useCallback } from "react";
import type { BubbleState, Ripple, Spark, Settings } from "../types";
import { stepPhysics } from "../physics";
import {
  FRICTION,
  WALL_BOUNCE,
  COLLISION_BOUNCE,
  DRIFT_FORCE_MAX,
  MIN_DRIFT_INTERVAL_MS,
  COLLISION_AUDIO_WINDOW_MS,
} from "../constants";
import { isAnySoundPlaying, getCurrentBubbleId } from "../audioManager";

export interface UsePhysicsLoopParams {
  bubblesRef: React.RefObject<BubbleState[]>;
  setBubbles: (b: BubbleState[]) => void;
  size: { w: number; h: number };
  settingsRef: React.RefObject<Settings>;
  /** Called when a user-driven collision happens (the bubble.lastTouchedAt is recent) */
  onCollisionSound: (b: BubbleState, volume: number) => void;
}

export interface UsePhysicsLoopResult {
  ripples: Ripple[];
  setRipples: React.Dispatch<React.SetStateAction<Ripple[]>>;
  sparks: Spark[];
  comboBurst: { x: number; y: number; n: number; particles: { dx: number; dy: number }[] } | null;
  confettiBurst: number;
  confettiParticles: { dx: number; dy: number; color: string }[];

  // Combo + confetti triggers (called by the tap handler in PootBox)
  triggerComboBurst: (x: number, y: number, n: number) => void;
  triggerConfetti: () => void;
}

const SPARK_COUNT_PER_COLLISION = 5;
const SPARK_LIFETIME_MS = 600;
const RIPPLE_LIFETIME_MS = 700;
const COMBO_BURST_LIFETIME_MS = 700;
const CONFETTI_PARTICLE_COUNT = 24;
const CONFETTI_LIFETIME_MS = 1200;

export function usePhysicsLoop(params: UsePhysicsLoopParams): UsePhysicsLoopResult {
  const { bubblesRef, setBubbles, size, settingsRef, onCollisionSound } = params;

  // ── Visual effect state ──────────────────────────────────────────────
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [comboBurst, setComboBurst] = useState<{ x: number; y: number; n: number; particles: { dx: number; dy: number }[] } | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [confettiParticles, setConfettiParticles] = useState<{ dx: number; dy: number; color: string }[]>([]);

  // ── Refs owned by this hook ──────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastDriftNudgeAtRef = useRef(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  const sparkIdRef = useRef(0);
  const rippleIdRef = useRef(0);
  const comboBurstTimeoutRef = useRef<number | null>(null);

  // ── Trigger combo burst at a tap location ───────────────────────────
  const triggerComboBurst = useCallback((x: number, y: number, n: number) => {
    const particles = Array.from({ length: 8 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 30;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
    });
    setComboBurst({ x, y, n, particles });
    if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
    comboBurstTimeoutRef.current = window.setTimeout(() => setComboBurst(null), COMBO_BURST_LIFETIME_MS);
  }, []);

  // ── Trigger confetti (every 10 taps) ─────────────────────────────────
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

  // ── Emit a ripple visual at a tap location (called from PootBox's tap handler) ──
  const spawnRipple = useCallback((x: number, y: number, color = "rgba(255,255,255,0.5)") => {
    const id = ++rippleIdRef.current;
    setRipples(prev => [...prev, { id, x, y, color }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), RIPPLE_LIFETIME_MS);
  }, []);

  // Expose the raf loop to the rest of the app via a custom event the bubble
  // pointer handler can listen to. The hook itself owns the physics tick.

  // ── The main raf tick ────────────────────────────────────────────────
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;
      const dt = lastFrameRef.current === 0 ? 16.67 : now - lastFrameRef.current;
      lastFrameRef.current = now;
      const clampedDt = Math.min(dt, 50);

      const collisions = stepPhysics(
        bubblesRef.current,
        {
          friction: FRICTION,
          wallBounce: WALL_BOUNCE,
          collisionBounce: COLLISION_BOUNCE,
          driftIntervalMs: MIN_DRIFT_INTERVAL_MS,
          driftForceMax: DRIFT_FORCE_MAX,
          viewportWidth: size.w,
          viewportHeight: size.h,
          collisionAudioWindowMs: COLLISION_AUDIO_WINDOW_MS,
        },
        now,
        clampedDt,
        lastDriftNudgeAtRef,
        collisionCooldownRef
      );

      // Handle collision events: emit sparks, play sound if user-driven
      const newSparks: Spark[] = [];
      for (const ev of collisions) {
        if (ev.shouldPlaySound) {
          const a = bubblesRef.current.find(b => b.id === (ev.a as { id?: string }).id);
          const b = bubblesRef.current.find(b => b.id === (ev.b as { id?: string }).id);
          if (a && b) onCollisionSound(a, settingsRef.current.volume);
        }
        const sx = ((ev.a as { pos: { x: number } }).pos.x + (ev.b as { pos: { x: number } }).pos.x) / 2;
        const sy = ((ev.a as { pos: { y: number } }).pos.y + (ev.b as { pos: { y: number } }).pos.y) / 2;
        for (let i = 0; i < SPARK_COUNT_PER_COLLISION; i++) {
          const angle = (i / SPARK_COUNT_PER_COLLISION) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 2 + Math.random() * 3;
          newSparks.push({
            id: ++sparkIdRef.current,
            x: sx,
            y: sy,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            color: "rgba(255,255,255,0.6)",
            life: SPARK_LIFETIME_MS,
          });
        }
      }
      if (newSparks.length > 0) {
        setSparks(prev => [...prev, ...newSparks]);
        setTimeout(() => {
          setSparks(prev => prev.filter(s => !newSparks.find(ns => ns.id === s.id)));
        }, SPARK_LIFETIME_MS);
      }

      // Re-render with new bubble positions
      setBubbles([...bubblesRef.current]);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [bubblesRef, setBubbles, size, settingsRef, onCollisionSound]);

  // ── Expose spawnRipple as a side effect so the parent can call it via ref ──
  // (Alternative: pass it through params from the tap handler, but the raf loop
  //  and tap handler both need it, so a ref-based approach is cleaner.)
  const spawnRippleRef = useRef(spawnRipple);
  useEffect(() => { spawnRippleRef.current = spawnRipple; });

  // ── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
    };
  }, []);

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
 * Standalone: polls isAnySoundPlaying every 100ms and updates the consumer.
 * Lives here so the parent doesn't need to manage a setInterval.
 *
 * v59: also returns the currently-playing bubble id (or null). This
 * lets BubbleCanvas render a pulse on the playing bubble. The
 * 100ms poll is fine for a 60fps animation — the lag is ~16ms
 * before the user sees the pulse, and the audio itself is
 * already playing by the time the React state updates.
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
