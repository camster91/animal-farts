// ConfettiBurst — spawns 12 confetti emoji pieces that float up and fade out.
// Used when the poot counter crosses a milestone (10, 25, 50, 100, 200).

import { useEffect, useState } from 'react';

const CONFETTI_EMOJIS = ['🎉', '🎊', '✨', '⭐', '💫', '🌟', '💖'];
const PIECE_COUNT = 12;

interface Piece {
  id: number;
  emoji: string;
  left: number; // percent
  delay: number; // seconds
}

interface ConfettiBurstProps {
  onComplete?: () => void;
}

export function ConfettiBurst({ onComplete }: ConfettiBurstProps) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: i,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      left:5 + Math.random() * 90, // 5–95%
      delay: Math.random() * 0.6, // 0–0.6s stagger
    }))
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      {pieces.map(piece => (
        <span
          key={piece.id}
          className="confetti-rise"
          style={{
            position: 'fixed',
            top: '60%',
            left: `${piece.left}%`,
            fontSize: '2rem',
            pointerEvents: 'none',
            zIndex: 99999,
            animationDelay: `${piece.delay}s`,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </>
  );
}
