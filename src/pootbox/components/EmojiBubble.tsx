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
}

// G5: Returns true for a genuine tap (< 250ms, moved < 10px), false for drag/hold
export function shouldPlayTapFeedback(
  pointerDownMs: number,
  pointerUpMs: number,
  movedPx: number,
): boolean {
  const durationMs = pointerUpMs - pointerDownMs;
  return durationMs < 250 && movedPx < 10;
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
      aria-label={`${emoji} sound`}
      style={{
        position: "absolute",
        left: pos.x - radius,
        top: pos.y - radius,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.12), inset 0 0 0 1.5px rgba(255,255,255,0.5)",
        border: "none",
        cursor: "grab",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translate(${pos.x - radius}px, ${pos.y - radius}px)`,
        userSelect: "none",
        WebkitUserSelect: "none",
        padding: 0,
        zIndex: 10,
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

      <style>{`
        @keyframes pootbox-bubble-tap {
          0%   { transform: scale(1); }
          35%  { transform: scale(0.85); }
          100% { transform: scale(1); }
        }
      `}</style>
    </button>
  );
};

export default EmojiBubble;