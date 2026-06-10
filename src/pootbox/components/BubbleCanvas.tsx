import type { FC } from "react";
import type { BubbleState } from "../types";
import EmojiBubble from "./EmojiBubble";

interface BubbleCanvasProps {
  bubbles: BubbleState[];
  pressedId: string | null;
  reducedMotion: boolean;
  showPlayedFor: string | null;
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