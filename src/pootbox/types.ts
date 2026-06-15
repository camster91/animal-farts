// === Domain types ===

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

export interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  life: number;
}

// Shape of the combo burst + confetti data owned by usePhysicsLoop. Kept
// here so the <CanvasEffects> component and its callers can agree on the
// shape without circular imports through the physics hook.
export interface ComboBurst {
  x: number;
  y: number;
  n: number;
  particles: { dx: number; dy: number }[];
}

export interface ConfettiParticle {
  dx: number;
  dy: number;
  color: string;
}

// --- Page / BubbleState (runtime) ---

export interface BubbleState {
  id: string; // "b:built-in:cow" | "b:custom:abc123"
  type: "built-in" | "custom";
  emoji: string;
  // built-in only:
  builtinKey?: string; // "cow", "dog", "fart-wet"…
  // custom only:
  blobUrl?: string;
  // physics (mutated by physics loop, read by CircleButton):
  pos: Vec2;
  vel: Vec2;
  radius: number;
  mass: number;
  // audio source:
  sound: string; // "/sounds/cow.mp3" | blobUrl
  // user interaction timestamps:
  lastTouchedAt: number;  // performance.now() or -1
  lastReleasedAt: number; // performance.now() or -1
}

export interface Page {
  id: string;             // "page:default" | "page:1700000000-abc"
  name: string;           // "My Animals", "Sleepy Time", "Sounds" (default "Sounds")
  emoji: string;         // page tab icon, default 🏠
  bubbles: BubbleState[];
  createdAt: number;
}

// --- BuiltInSound (static library metadata) ---

export interface BuiltInSound {
  key: string;    // "cow", "fart-wet-001-3-fart-wet", "burp"…
  emoji: string;  // 🐄
  name: string;   // "Cow", "3 Fart Wet", "Toilet Flush"
  file: string;   // "/sounds/cow.mp3"
  bucket: "animal" | "fart" | "silly";
  // v70: sub-bucket for the fart directory tree. Empty string
  // for non-fart entries. Used by the SoundLibrary filter to
  // show a second-tier chip row (Bubbly / Dry / Echo / Long /
  // Squeaky / Wet) when the user has the Farts top-level
  // filter active.
  subBucket?: string;
}

// --- Settings ---

export interface Settings {
  volume: number;
  reducedMotion: boolean;
}

// --- Backward-compatible type aliases (for existing PootBox.tsx) ---
// These allow the old code to keep building while the new types exist in parallel.
// PhysicsCircle must preserve ALL old Circle fields + runtime fields for full compat.

/** @deprecated Use BubbleState — persists for PootBox.tsx compatibility until v46e */
export interface PhysicsCircle extends Circle {
  pos: Vec2;
  vel: Vec2;
  lastTouchedAt: number;
  lastReleasedAt: number;
  lastDriftedAt: number;
  isHero: boolean;
}

/** @deprecated Use BubbleState — persists for PootBox.tsx compatibility until v46e */
export interface CustomCircle {
  id: string;
  emoji: string;
  blobUrl: string;
  radius: number;
  mass: number;
  createdAt: number;
}

/** @deprecated Use BubbleState — persists for PootBox.tsx compatibility until v46e */
export interface Circle {
  id: string;
  emoji: string;
  color: string;
  shadow: string;
  hatchEmoji: string;
  sounds: string[];
  radius: number;
  mass: number;
}

// === Component prop types ===

// Use DOM PointerEvent (not React's) to avoid requiring React types in test tsconfig.
// The React wrapper is identical at runtime.
export interface CircleButtonProps {
  circle: PhysicsCircle;
  pressed: boolean;
  shaking: boolean;
  reducedMotion: boolean;
  showHeroPulse: boolean;
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onPointerMove: (id: string, e: React.PointerEvent) => void;
  onPointerUp: (id: string, e: React.PointerEvent) => void;
  onPointerCancel: (id: string) => void;
}

export interface SettingsModalProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}