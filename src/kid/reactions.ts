// Animation primitives for Poot Party kid's screen.
// All animations respect prefers-reduced-motion.

export const REACTION_EMOJIS = ['💨', '💥', '💦', '⭐'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

// Scale-bounce keyframe —1.0 → 1.3 → 1.0 over 280ms
export const SCALE_BOUNCE = `
@keyframes scale-bounce {
  0%   { transform: scale(1.0); }
  40%  { transform: scale(1.3); }
  100% { transform: scale(1.0); }
}
`;

// Reaction emoji rise-and-fade —600ms
export const REACTION_RISE = `
@keyframes reaction-rise {
  0%   { opacity: 1; transform: translateY(0) scale(0.8); }
  20%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.6); }
}
`;

// Reduced-motion fallback — brief opacity flash
export const TAP_FLASH = `
@keyframes tap-flash {
  0%   { opacity: 1; }
  50%  { opacity: 0.6; }
  100% { opacity: 1; }
}
`;

// Inject global keyframes once (idempotent)
export function injectKeyframes() {
  const id = 'poot-party-animations';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = SCALE_BOUNCE + REACTION_RISE + TAP_FLASH;
  document.head.appendChild(style);
}

export function randomReaction(): ReactionEmoji {
  return REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
}
