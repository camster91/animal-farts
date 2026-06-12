/* eslint-disable @typescript-eslint/no-unused-vars */
// usePhysicsLoop.ts — extracted from PootBox.tsx in v52-6
// Owns: raf tick, collision events, ripples, sparks, combo, confetti, lifetimeTapsRef

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
import { isAnySoundPlaying } from "../audioManager";

export interface UsePhysicsLoopParams {
  bubblesRef: React.RefObject<BubbleState[]>;
  setBubbles: (b: BubbleState[]) => void;
  size: { w: number; h: number };
  settingsRef: React.RefObject<Settings>;
  onCollisionSound: (sound: string, volume: number) => void;
  _onPlayFromBubble: (b: BubbleState, volume: number) => void;
}

export function usePhysicsLoop({
  bubblesRef,
  setBubbles,
  size,
  settingsRef,
  onCollisionSound,
  _onPlayFromBubble,
}: UsePhysicsLoopParams) {
  // ── Refs owned by this hook ────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastDriftNudgeAtRef = useRef(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  const sparkIdRef = useRef(0);
  const rippleIdRef = useRef(0);

  // Combo refs
  const comboCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const comboResetTimerRef = useRef<number | null>(null);
  const comboBurstTimeoutRef = useRef<number | null>(null);

  // Lifetime taps
  const lifetimeTapsRef = useRef(0);

  // ── Effect state ─────────────────────────────────────────────────────
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [comboCount, setComboCount] = useState(0);
  const [comboBurst, setComboBurst] = useState<{
    x: number;
    y: number;
    n: number;
    particles: { dx: number; dy: number }[];
  } | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [confettiParticles, setConfettiParticles] = useState<
    { dx: number; dy: number; color: string }[]
  >([]);
  const [soundPlaying, setSoundPlaying] = useState(false);

  // ── Sound playing poll ────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => {
      setSoundPlaying(isAnySoundPlaying());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // ── Trigger combo burst ──────────────────────────────────────────────
  const triggerComboBurst = useCallback((x: number, y: number, n: number) => {
    const particles = Array.from({ length: 8 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 30;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
    });
    setComboBurst({ x, y, n, particles });
    if (comboBurstTimeoutRef.current)
      window.clearTimeout(comboBurstTimeoutRef.current);
    comboBurstTimeoutRef.current = window.setTimeout(
      () => setComboBurst(null),
      700
    );
  }, []);

  // ── Trigger confetti ──────────────────────────────────────────────────
  const triggerConfetti = useCallback(() => {
    const colors = [
      "#FF6B6B",
      "#FFD93D",
      "#6BCB77",
      "#4D96FF",
      "#FF9F1C",
    ];
    const particles = Array.from({ length: 24 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      return {
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed - 30,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    setConfettiParticles(particles);
    setConfettiBurst((c) => c + 1);
  }, []);

  // ── Increment combo ──────────────────────────────────────────────────
  // Called from tap handler. Returns the new combo count.
  // Internally handles 800ms reset and lifetime taps confetti.
  const incrementCombo = useCallback(() => {
    const now = performance.now();
    let newCombo: number;
    if (now - lastTapAtRef.current < 800) {
      newCombo = comboCountRef.current + 1;
      setComboCount(newCombo);
    } else {
      newCombo = 1;
      setComboCount(1);
    }
    comboCountRef.current = newCombo;
    lastTapAtRef.current = now;
    if (comboResetTimerRef.current)
      window.clearTimeout(comboResetTimerRef.current);
    comboResetTimerRef.current = window.setTimeout(() => {
      setComboCount(0);
      comboCountRef.current = 0;
    }, 800);

    // Lifetime taps → confetti every 10
    const newLifetime = lifetimeTapsRef.current + 1;
    lifetimeTapsRef.current = newLifetime;
    if (newLifetime % 10 === 0) triggerConfetti();

    return newCombo;
  }, [triggerConfetti]);

  // ── Reset combo ───────────────────────────────────────────────────────
  const resetCombo = useCallback(() => {
    setComboCount(0);
    comboCountRef.current = 0;
    if (comboResetTimerRef.current) {
      window.clearTimeout(comboResetTimerRef.current);
      comboResetTimerRef.current = null;
    }
  }, []);

  // ── Spawn ripple ──────────────────────────────────────────────────────
  // Exposed so PootBox tap handler can call it (also used on collision in raf)
  const spawnRipple = useCallback(
    (x: number, y: number, color = "rgba(255,255,255,0.5)") => {
      const id = ++rippleIdRef.current;
      setRipples((prev) => [...prev, { id, x, y, color }]);
      setTimeout(
        () => setRipples((prev) => prev.filter((r) => r.id !== id)),
        700
      );
    },
    []
  );

  // ── Physics loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;
      const dt =
        lastFrameRef.current === 0 ? 16.67 : now - lastFrameRef.current;
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

      for (const ev of collisions) {
        // Play collision sound
        if (ev.shouldPlaySound) {
          const bA = bubblesRef.current.find(
            (b) => b.id === (ev.a as unknown as BubbleState).id
          );
          const bB = bubblesRef.current.find(
            (b) => b.id === (ev.b as unknown as BubbleState).id
          );
          if (bA && bB) {
            const winner =
              bA.lastTouchedAt >= bB.lastTouchedAt ? bA : bB;
            onCollisionSound(winner.sound, settingsRef.current.volume);
          }
        }

        // Spawn sparks at collision midpoint
        const sx = (ev.a.pos.x + ev.b.pos.x) / 2;
        const sy = (ev.a.pos.y + ev.b.pos.y) / 2;
        const newSparks: Spark[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 2 + Math.random() * 3;
          newSparks.push({
            id: ++sparkIdRef.current,
            x: sx,
            y: sy,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            color: "rgba(255,255,255,0.6)",
            life: 600,
          });
        }
        setSparks((prev) => [...prev, ...newSparks]);
        setTimeout(
          () =>
            setSparks((prev) =>
              prev.filter((s) => !newSparks.find((ns) => ns.id === s.id))
            ),
          600
        );

        // Spawn ripple at collision midpoint
        const rippleId = ++rippleIdRef.current;
        setRipples((prev) => [
          ...prev,
          { id: rippleId, x: sx, y: sy, color: "rgba(255,255,255,0.4)" },
        ]);
        setTimeout(
          () => setRipples((prev) => prev.filter((r) => r.id !== rippleId)),
          700
        );
      }

      // Sync to state (bubble positions rendered via BubbleCanvas)
      setBubbles([...bubblesRef.current]);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size.w, size.h, setBubbles, settingsRef]);

  // ── Cleanup ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (comboResetTimerRef.current)
        window.clearTimeout(comboResetTimerRef.current);
      if (comboBurstTimeoutRef.current)
        window.clearTimeout(comboBurstTimeoutRef.current);
    };
  }, []);

  return {
    // State
    ripples,
    sparks,
    comboCount,
    comboBurst,
    confettiBurst,
    confettiParticles,
    soundPlaying,

    // Methods
    triggerComboBurst,
    triggerConfetti,
    incrementCombo,
    resetCombo,
    spawnRipple,
  };
}