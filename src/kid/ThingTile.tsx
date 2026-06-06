import { useRef, useCallback, useEffect, useState } from 'react';
import type { Thing } from './scenes';
import { injectKeyframes, randomReaction } from './reactions';

injectKeyframes();

interface Props {
  thing: Thing;
  onTap: (thing: Thing, e?: React.MouseEvent) => void;
  shakeJitter?: boolean;
}

export function ThingTile({ thing, onTap, shakeJitter }: Props) {
  const tileRef = useRef<HTMLButtonElement>(null);
  const [idleWobble, setIdleWobble] = useState(false);
  const lastTapRef = useRef<number>(Date.now());
  const wobbleTimerRef = useRef<number | null>(null);

  // Subtle idle wobble: if not tapped in 10s, do a tiny 1.0→1.05→1.0 scale pulse
  useEffect(() => {
    const scheduleWobble = () => {
      wobbleTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - lastTapRef.current;
        if (elapsed >= 10_000) {
          setIdleWobble(true);
          setTimeout(() => {
            setIdleWobble(false);
            scheduleWobble();
          }, 2000);
        } else {
          scheduleWobble();
        }
      }, 10_000);
    };
    scheduleWobble();
    return () => {
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    };
  }, []);

  const handleTap = useCallback((e: React.MouseEvent) => {
    lastTapRef.current = Date.now();
    setIdleWobble(false);
    onTap(thing, e);

    // Reaction emoji at tap point
    const el = tileRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const reaction = document.createElement('div');
    reaction.textContent = randomReaction();
    reaction.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 999',
      'font-size: 2rem',
      'left: ' + (rect.left + rect.width / 2 - 16) + 'px',
      'top: ' + (rect.top + rect.height / 2 - 16) + 'px',
      'animation: reaction-rise 600ms ease-out forwards',
    ].join(';');
    document.body.appendChild(reaction);
    setTimeout(() => reaction.remove(), 650);
  }, [thing, onTap]);

  return (
    <button
      ref={tileRef}
      onClick={handleTap}
      aria-label={`${thing.name}, tap to hear a sound`}
      className={"absolute active:scale-90 select-none" + (shakeJitter ? " shake-jiggle" : "")}
      style={{
        left: `${thing.x}%`,
        top: `${thing.y}%`,
        width: `${thing.size}vw`,
        height: `${thing.size}vw`,
        transform: 'translate(-50%, -50%)' + (idleWobble ? ' scale(1.05)' : ''),
        transition: idleWobble ? 'transform 1000ms ease-in-out' : 'transform 280ms ease-out, scale 1000ms ease-in-out',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        className="block w-full h-full flex items-center justify-center text-6xl sm:text-7xl drop-shadow-lg"
        style={{ animation: idleWobble ? 'none' : 'scale-bounce 280ms ease-out' }}
      >
        {thing.emoji}
      </span>
    </button>
  );
}
