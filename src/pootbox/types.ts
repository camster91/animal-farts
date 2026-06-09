// === Domain types ===

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

export interface CustomCircle {
  id: string;
  emoji: string;
  blobUrl: string;
  radius: number;
  mass: number;
  createdAt: number;
}

export interface PhysicsCircle extends Circle {
  pos: Vec2;
  vel: Vec2;
  lastTouchedAt: number;
  lastReleasedAt: number;
  lastDriftedAt: number;
  isHero: boolean;
}

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

export interface Settings {
  volume: number;
  reducedMotion: boolean;
}

// === Component prop types ===

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