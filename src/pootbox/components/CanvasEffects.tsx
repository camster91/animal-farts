// CanvasEffects.tsx — extracted from PootBox.tsx in v53
// Owns the visual-only effects layer that sits on top of the bubble canvas:
// ripples, sparks, combo glow + star burst, combo badge, confetti. All of
// these are aria-hidden, pointer-events:none, and position:fixed or absolute
// relative to the canvas wrapper. None of them participate in the physics
// step; they only render from the state owned by usePhysicsLoop.
//
// What stays in PootBox: the stop button (needs setSoundPlaying) and the
// mic-denied banner (needs the recPhase from useRecording). Those are
// interactive overlays, not visual effects.

import type { Ripple, Spark, ComboBurst, ConfettiParticle } from "../types";

// ─── Atoms (visual only) ────────────────────────────────────────────────────

function RippleView({ ripple }: { ripple: Ripple }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: ripple.x,
        top: ripple.y,
        width: 0,
        height: 0,
        borderRadius: "50%",
        border: `3px solid ${ripple.color}`,
        transform: "translate(-50%, -50%)",
        animation: "pootbox-ripple 0.7s ease-out forwards",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}

function SparkView({ spark }: { spark: Spark }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: spark.x,
        top: spark.y,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: spark.color,
        transform: "translate(-50%, -50%)",
        animation: "pootbox-spark 0.6s ease-out forwards",
        ["--dx" as string]: `${spark.dx * 12}px`,
        ["--dy" as string]: `${spark.dy * 12}px`,
        pointerEvents: "none",
        zIndex: 11,
        boxShadow: `0 0 6px ${spark.color}`,
      }}
    />
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface CanvasEffectsProps {
  ripples: Ripple[];
  sparks: Spark[];
  comboBurst: ComboBurst | null;
  confettiBurst: number;
  confettiParticles: ConfettiParticle[];
  comboCount: number;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CanvasEffects({
  ripples,
  sparks,
  comboBurst,
  confettiBurst,
  confettiParticles,
  comboCount,
}: CanvasEffectsProps) {
  return (
    <>
      {ripples.map((r) => (
        <RippleView key={r.id} ripple={r} />
      ))}
      {sparks.map((s) => (
        <SparkView key={s.id} spark={s} />
      ))}

      {comboCount >= 5 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at center, rgba(255,215,0,0.15) 0%, transparent 70%)",
            zIndex: 3,
          }}
        />
      )}

      {comboBurst &&
        comboBurst.particles.map((p, i) => (
          <div
            key={`combo-${comboBurst.n}-${i}`}
            aria-hidden
            style={{
              position: "fixed",
              left: comboBurst.x,
              top: comboBurst.y,
              fontSize: "1.5rem",
              pointerEvents: "none",
              zIndex: 13,
              animation: "pootbox-combo-star 0.7s ease-out forwards",
              ["--dx" as string]: `${p.dx}px`,
              ["--dy" as string]: `${p.dy}px`,
            }}
          >
            {i % 2 === 0 ? "⭐" : "✨"}
          </div>
        ))}

      {confettiBurst > 0 &&
        confettiParticles.map((p, i) => (
          <div
            key={`confetti-${confettiBurst}-${i}`}
            aria-hidden
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              width: 10,
              height: 14,
              borderRadius: 2,
              background: p.color,
              pointerEvents: "none",
              zIndex: 14,
              animation: "pootbox-confetti 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
              ["--dx" as string]: `${p.dx}px`,
              ["--dy" as string]: `${p.dy}px`,
            }}
          />
        ))}

      {comboCount >= 2 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: "calc(20px + env(safe-area-inset-top, 0px))",
            right: 20,
            background: "rgba(0,0,0,0.65)",
            color: comboCount >= 5 ? "#FFD700" : "white",
            padding: "8px 16px",
            borderRadius: 20,
            fontSize: "1.4rem",
            fontWeight: 800,
            fontFamily: "Fredoka, system-ui, sans-serif",
            pointerEvents: "none",
            zIndex: 11,
            transform: comboCount >= 5 ? "scale(1.15)" : "scale(1)",
            transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms",
            boxShadow: comboCount >= 5 ? "0 0 24px rgba(255,215,0,0.6)" : "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          ×{comboCount}
        </div>
      )}
    </>
  );
}
