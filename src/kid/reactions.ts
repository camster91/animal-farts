// Animation primitives for Poot Party kid's screen.
// All animations respect prefers-reduced-motion.

export const KID_EMOJIS = ['😄', '😂', '🤣', '🥳', '✨', '⭐', '💫', '🌟', '🎉', '🎊', '💥', '❤️', '💖', '💕', '💝', '🦄'] as const;
export type KidEmoji = typeof KID_EMOJIS[number];

export const REACTION_EMOJIS = ['💨', '💥', '💦', '⭐'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

// ─── Keyframe strings (injected into <head> by injectKeyframes) ─────────────

// Scale-bounce: 1.0 → 1.3 → 1.0 over 280ms
const SCALE_BOUNCE_KF = `
@keyframes scale-bounce {
  0%   { transform: scale(1.0); }
  40%  { transform: scale(1.3); }
  100% { transform: scale(1.0); }
}`;

// Bounce: 1.0 → 1.4 → 0.9 → 1.1 → 1.0 (satisfying bounce)
const REACT_BOUNCE_KF = `
@keyframes react-bounce {
  0%   { transform: scale(1.0) rotate(0deg); }
  25%  { transform: scale(1.4) rotate(-5deg); }
  50%  { transform: scale(0.9) rotate(5deg); }
  75%  { transform: scale(1.1) rotate(-2deg); }
  100% { transform: scale(1.0) rotate(0deg); }
}`;

// Spin: 0deg → 360deg, 1.0 → 1.2 → 1.0
const REACT_SPIN_KF = `
@keyframes react-spin {
  0%   { transform: scale(1.0) rotate(0deg); }
  50%  { transform: scale(1.2) rotate(180deg); }
  100% { transform: scale(1.0) rotate(360deg); }
}`;

// Shake: translateX -10px → 10px → -8px → 8px → 0
const REACT_SHAKE_KF = `
@keyframes react-shake {
  0%   { transform: translateX(0); }
  20%  { transform: translateX(-10px); }
  40%  { transform: translateX(10px); }
  60%  { transform: translateX(-8px); }
  80%  { transform: translateX(8px); }
  100% { transform: translateX(0); }
}`;

// Squish: scale 1.0 → 1.4 → 0.6 → 1.0 (squash and stretch)
const REACT_SQUISH_KF = `
@keyframes react-squish {
  0%   { transform: scale(1.0, 1.0); }
  30%  { transform: scale(1.4, 0.8); }
  60%  { transform: scale(0.8, 1.4); }
  100% { transform: scale(1.0, 1.0); }
}`;

// Jump: translateY 0 → -30px → 0
const REACT_JUMP_KF = `
@keyframes react-jump {
  0%   { transform: translateY(0) scale(1.0); }
  40%  { transform: translateY(-30px) scale(1.1); }
  100% { transform: translateY(0) scale(1.0); }
}`;

// Pop: scale 0.0 → 1.3 → 1.0
const REACT_POP_KF = `
@keyframes react-pop {
  0%   { transform: scale(0.0); opacity: 0.8; }
  60%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1.0); opacity: 1; }
}`;

// Neighbor pulse: gentle bounce for nearby things
const NEIGHBOR_PULSE_KF = `
@keyframes neighbor-pulse {
  0%   { transform: scale(1.0) rotate(0deg); }
  35%  { transform: scale(1.15) rotate(-6deg); }
  65%  { transform: scale(0.95) rotate(6deg); }
  100% { transform: scale(1.0) rotate(0deg); }
}`;

// Ambient wobble: 1.0 → 1.04 → 0.98 → 1.0 over 1.6s (single-shot, not looping)
const AMBIENT_WOBBLE_KF = `
@keyframes ambient-wobble {
  0%   { transform: scale(1.0); }
  35%  { transform: scale(1.04); }
  65%  { transform: scale(0.98); }
  100% { transform: scale(1.0); }
}`;

// Reaction emoji rise-and-fade —1s
const REACTION_RISE_KF = `
@keyframes reaction-rise {
  0%   { opacity: 1; transform: translateY(0) scale(0.8); }
  20%  { opacity: 1; transform: translateY(-10px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-60px) scale(0.6); }
}`;

// Reduced-motion fallback — brief opacity flash
const TAP_FLASH_KF = `
@keyframes tap-flash {
  0%   { opacity: 1; }
  50%  { opacity: 0.6; }
  100% { opacity: 1; }
}`;

// ─── Export the keyframe strings so callers can reference them ───────────────
export const REACTION_KEYFRAMES = {
  'scale-bounce':    SCALE_BOUNCE_KF,
  'react-bounce':    REACT_BOUNCE_KF,
  'react-spin':      REACT_SPIN_KF,
  'react-shake':     REACT_SHAKE_KF,
  'react-squish':    REACT_SQUISH_KF,
  'react-jump':      REACT_JUMP_KF,
  'react-pop':       REACT_POP_KF,
  'neighbor-pulse':  NEIGHBOR_PULSE_KF,
  'ambient-wobble':  AMBIENT_WOBBLE_KF,
  'reaction-rise':   REACTION_RISE_KF,
  'tap-flash':       TAP_FLASH_KF,
} as const;

export const ALL_KEYFRAMES = Object.values(REACTION_KEYFRAMES).join('\n');

// Inject global keyframes once (idempotent)
export function injectKeyframes() {
  const id = 'poot-party-animations';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = ALL_KEYFRAMES;
  document.head.appendChild(style);
}

// ─── Reaction selection ───────────────────────────────────────────────────────

export type ReactionType = 'bounce' | 'spin' | 'shake' | 'squish' | 'jump' | 'pop';

const REACTION_TYPES: ReactionType[] = ['bounce', 'spin', 'shake', 'squish', 'jump', 'pop'];

export const REACTION_DURATIONS: Record<ReactionType, number> = {
  bounce: 400,
  spin:   450,
  shake:  350,
  squish: 400,
  jump:   400,
  pop:    320,
};

export function randomReactionType(): ReactionType {
  return REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];
}

export function getReactionDuration(type: ReactionType): number {
  return REACTION_DURATIONS[type];
}

export function randomKidEmoji(): KidEmoji {
  return KID_EMOJIS[Math.floor(Math.random() * KID_EMOJIS.length)];
}

export function randomReaction(): ReactionEmoji {
  return REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
}