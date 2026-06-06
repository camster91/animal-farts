import { useRef, useCallback } from 'react';
import type { Thing } from './scenes';
import { injectKeyframes, randomReaction } from './reactions';

injectKeyframes();

interface Props {
  thing: Thing;
  onTap: (thing: Thing) => void;
}

export function ThingTile({ thing, onTap }: Props) {
  const tileRef = useRef<HTMLButtonElement>(null);

  const handleTap = useCallback(() => {
    onTap(thing);

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
      className="absolute active:scale-90 select-none"
      style={{
        left: `${thing.x}%`,
        top: `${thing.y}%`,
        width: `${thing.size}vw`,
        height: `${thing.size}vw`,
        transform: 'translate(-50%, -50%)',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span
        className="block w-full h-full flex items-center justify-center text-6xl sm:text-7xl drop-shadow-lg"
        style={{ animation: 'scale-bounce 280ms ease-out' }}
      >
        {thing.emoji}
      </span>
    </button>
  );
}
