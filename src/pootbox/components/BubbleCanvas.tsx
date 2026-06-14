import type { FC } from "react";
import type { BubbleState } from "../types";
import EmojiBubble from "./EmojiBubble";

interface BubbleCanvasProps {
  bubbles: BubbleState[];
  pressedId: string | null;
  reducedMotion: boolean;
  showPlayedFor: string | null;
  /** v59: the bubble currently playing audio (or null). Bubbles
   *  matching this id render with a pulsing ring + scale-up so
   *  the kid sees which one is "live" and can tap to stop. */
  playingBubbleId: string | null;
  onBubblePointerDown: (id: string, e: React.PointerEvent) => void;
  onBubblePointerMove: (id: string, e: React.PointerEvent) => void;
  onBubblePointerUp:   (id: string, e: React.PointerEvent) => void;
  onBubblePointerCancel: (id: string) => void;
}

const BubbleCanvas: FC<BubbleCanvasProps> = ({
  bubbles,
  pressedId,
  reducedMotion,
  showPlayedFor,
  playingBubbleId,
  onBubblePointerDown,
  onBubblePointerMove,
  onBubblePointerUp,
  onBubblePointerCancel,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      {bubbles.map((b) => (
        <EmojiBubble
          key={b.id}
          id={b.id}
          emoji={b.emoji}
          pos={b.pos}
          radius={b.radius}
          pressed={pressedId === b.id}
          reducedMotion={reducedMotion}
          showPlayedIndicator={showPlayedFor === b.id}
          isPlaying={playingBubbleId === b.id}
          onPointerDown={(e) => onBubblePointerDown(b.id, e)}
          onPointerMove={(e) => onBubblePointerMove(b.id, e)}
          onPointerUp={(e) => onBubblePointerUp(b.id, e)}
          onPointerCancel={() => onBubblePointerCancel(b.id)}
        />
      ))}
    </div>
  );
};

export default BubbleCanvas;