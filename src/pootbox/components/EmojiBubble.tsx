import type { FC } from "react";
import { useState } from "react";

interface EmojiBubbleProps {
  id: string;
  emoji: string;
  pos: { x: number; y: number };
  radius: number;
  pressed: boolean;
  reducedMotion: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp:   (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  showPlayedIndicator?: boolean;
  /** v59: true when this is the bubble currently playing audio.
   *  Adds a pulsing ring + slight scale-up so the kid sees which
   *  bubble is "live" and can tap it to stop (instead of restart). */
  isPlaying?: boolean;
}

const EmojiBubble: FC<EmojiBubbleProps> = ({
  id,
  emoji,
  pos,
  radius,
  pressed,
  reducedMotion,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  showPlayedIndicator = false,
  isPlaying = false,
}) => {
  const size = radius * 2;
  const fontSize = Math.round(radius * 1.3);
  const [tapCount, setTapCount] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    // G5: increment tapCount to re-trigger the squish animation via key change
    setTapCount((c) => c + 1);
    onPointerDown(e);
  };

  return (
    <button
      id={id}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label={`${emoji} sound${isPlaying ? " (playing — tap to stop)" : ""}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        // v59: when playing, a pulsing ring + slight scale + amber tint
        boxShadow: isPlaying
          ? "0 0 0 4px rgba(245,158,11,0.85), 0 0 24px rgba(245,158,11,0.4), 0 6px 18px rgba(0,0,0,0.12)"
          : "0 6px 18px rgba(0,0,0,0.12), inset 0 0 0 1.5px rgba(255,255,255,0.5)",
        border: "none",
        cursor: "grab",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Position is set by transform only (left/top must stay 0 to avoid doubling)
        transform: `translate(${pos.x - radius}px, ${pos.y - radius}px)${
          isPlaying && !reducedMotion ? " scale(1.06)" : ""
        }`,
        userSelect: "none",
        WebkitUserSelect: "none",
        padding: 0,
        zIndex: 10,
        // v59: continuous pulse on the playing bubble. Animation is
        // suppressed under reduced-motion.
        animation: isPlaying && !reducedMotion
          ? "pootbox-bubble-playing 1.2s ease-in-out infinite"
          : "none",
      }}
    >
      {/* G5: Child wrapper handles scale animation; parent keeps physics translate */}
      {/* key={tapCount} forces re-mount → re-triggers @keyframes on each tap */}
      <div
        key={tapCount}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: pressed && !reducedMotion ? "scale(0.92)" : "scale(1)",
          transition: reducedMotion ? "none" : "transform 120ms ease",
          animation: reducedMotion ? "none" : "pootbox-bubble-tap 180ms ease-out",
        }}
      >
        <span
          style={{
            fontSize,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          {emoji}
        </span>

        {showPlayedIndicator && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              color: "#F59E0B",
              transform: "scale(1)",
              transition: "transform 200ms ease",
              pointerEvents: "none",
            }}
          >
            ♪
          </span>
        )}
      </div>
    </button>
  );
};

export default EmojiBubble;