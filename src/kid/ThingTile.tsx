import { useRef, useCallback, useEffect, useState } from 'react';
import type { Thing } from './scenes';
import {
  injectKeyframes,
  randomKidEmoji,
  randomReactionType,
  getReactionDuration,
  type ReactionType,
} from './reactions';

injectKeyframes();

interface Props {
  thing: Thing;
  onTap: (thing: Thing, e?: React.MouseEvent) => void;
  /** When set, triggers a reaction animation on this thing (from pair reactions) */
  reaction?: ReactionType | null;
  /** Callback when the reaction animation finishes */
  onReactionDone?: () => void;
  /** Stagger offset (ms) for the idle wobble — each thing gets a random offset */
  wobbleOffset?: number;
  /** When true, all things do a shake-jiggle (shake-to-shuffle) */
  shakeJitter?: boolean;
  /** Index in the scene — used to stagger the entrance animation */
  index?: number;
}

const ANIMATION_MAP: Record<ReactionType, string> = {
  bounce: 'react-bounce 400ms ease-out forwards',
  spin:   'react-spin 450ms ease-in-out forwards',
  shake:  'react-shake 350ms ease-in-out forwards',
  squish: 'react-squish 400ms ease-in-out forwards',
  jump:   'react-jump 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  pop:    'react-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
};

export function ThingTile({ thing, onTap, reaction, onReactionDone, wobbleOffset = 0, shakeJitter, index = 0 }: Props) {
  const tileRef = useRef<HTMLButtonElement>(null);
  const lastTapRef = useRef<number>(Date.now());
  const wobbleTimerRef = useRef<number | null>(null);
  const [isWobbling, setIsWobbling] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);
  const reactionKeyRef = useRef<number>(0);

  // Ambient idle wobble: if not tapped in 8s, do a subtle scale pulse once
  useEffect(() => {
    const scheduleWobble = () => {
      // Add random stagger (0–3s) so things don't all wobble together
      const delay = 8_000 + wobbleOffset;
      wobbleTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - lastTapRef.current;
        if (elapsed >= 8_000) {
          setIsWobbling(true);
          setTimeout(() => {
            setIsWobbling(false);
            scheduleWobble();
          }, 1_600);
        } else {
          scheduleWobble();
        }
      }, delay);
    };
    const initialDelay = window.setTimeout(() => scheduleWobble(), 8_000 + wobbleOffset);
    return () => {
      clearTimeout(initialDelay);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    };
  }, [wobbleOffset]);

  // Trigger reaction animation when `reaction` prop changes
  useEffect(() => {
    if (!reaction) return;
    const type: ReactionType = reaction;
    setCurrentReaction(type);
    reactionKeyRef.current += 1;
    const duration = getReactionDuration(type);
    const timer = window.setTimeout(() => {
      setCurrentReaction(null);
      onReactionDone?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [reaction, onReactionDone]);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    lastTapRef.current = Date.now();
    setIsWobbling(false);

    // Cancel any in-progress reaction so rapid taps restart animation
    setCurrentReaction(null);
    // Pick a fresh reaction after tiny tick so React commits the null first
    setTimeout(() => {
      const type = randomReactionType();
      setCurrentReaction(type);
      reactionKeyRef.current += 1;
      const duration = getReactionDuration(type);
      setTimeout(() => setCurrentReaction(null), duration);
    }, 0);

    // Spawn TWO floating emojis at the tap point:
    // 1. A "poot" puff (💨) — small, fast, signature of the app
    // 2. A random kid emoji — bigger, slower, more delightful
    const el = tileRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      // Poot puff
      const poof = document.createElement('div');
      poof.textContent = '💨';
      poof.style.cssText = [
        'position: fixed',
        'pointer-events: none',
        'z-index: 998',
        'font-size: 1.6rem',
        `left: ${cx - 14}px`,
        `top: ${cy - 14}px`,
        'animation: poof-rise 0.7s ease-out forwards',
      ].join(';');
      document.body.appendChild(poof);
      setTimeout(() => poof.remove(), 750);

      // Bigger kid emoji (slightly offset, slightly delayed)
      setTimeout(() => {
        const emoji = document.createElement('div');
        emoji.textContent = randomKidEmoji();
        emoji.style.cssText = [
          'position: fixed',
          'pointer-events: none',
          'z-index: 999',
          'font-size: 2.2rem',
          `left: ${cx - 18 + (Math.random() - 0.5) * 24}px`,
          `top: ${cy - 18}px`,
          'animation: reaction-rise 1s ease-out forwards',
        ].join(';');
        document.body.appendChild(emoji);
        setTimeout(() => emoji.remove(), 1_050);
      }, 60);
    }

    onTap(thing, e as React.MouseEvent);
  }, [thing, onTap]);

  const animStyle = currentReaction ? ANIMATION_MAP[currentReaction] : undefined;

  return (
    <button
      ref={tileRef}
      onClick={handleTap}
      aria-label={`${thing.name}, tap to hear a sound`}
      className={"absolute select-none thing-entrance" + (shakeJitter ? " shake-jiggle" : "")}
      style={{
        left: `${thing.x}%`,
        top: `${thing.y}%`,
        width: `${thing.size}vw`,
        height: `${thing.size}vw`,
        transform: 'translate(-50%, -50%)' + (isWobbling ? ' scale(1.04)' : ''),
        transition: isWobbling
          ? 'transform 1600ms ease-in-out'
          : 'transform 100ms ease-out',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        animationDelay: `${index * 60}ms`,
      } as React.CSSProperties}
    >
      <span
        key={reactionKeyRef.current}
        className="block w-full h-full flex items-center justify-center text-6xl sm:text-7xl drop-shadow-lg"
        style={{
          animation: animStyle ?? (isWobbling ? 'ambient-wobble 1.6s ease-in-out' : 'scale-bounce 280ms ease-out'),
        }}
      >
        {thing.emoji}
      </span>
    </button>
  );
}