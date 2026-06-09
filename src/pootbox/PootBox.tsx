// PootBox — minimal sound toy for kids. v39.
//
// v39: add your own sound + emoji. Hold the + button → mic overlay →
//      speak/sing/whatever → pick an emoji → it drops onto the canvas.
//      Recordings persist in IndexedDB. Tap a custom circle to show
//      a red × to delete it. Cap at 12 custom circles.
// v38: removed gyroscope. Drift is now a small random nudge every 2.2s.
//      Added iOS audio-unlocker (silent WAV on first user tap) so the
//      first sound actually plays.
// v37: floating-in-water mode. Toned down everything.
// v36: gyroscope (tilt) drift + tap-empty-to-push.
// v35: zero-G floating.
// v34: staggered drop-in.
// v33: emojis on cream background.
// v32: physics-based drag/throw/collide.
// v31: grid layout.
//
// 4 user inputs, all "user-driven":
//   1. Tap emoji        → its sound
//   2. Drag/throw emoji → it + any circle it bumps
//   3. Hold emoji 1.5s  → hatches a small animal
//   4. Tap empty space  → soft radial push from tap point
//   5. Shake phone      → ripple (small impulse)
//   6. Tap + button     → record your own sound, pick an emoji
//
// Plus a passive random drift tick every 2.2s that nudges every circle.
// Collision sounds play if the colliding pair was touched/tap-pushed/
// drift-nudged in the last ~500ms. Idle field is silent.
//
// Physics: requestAnimationFrame loop, 60fps. Each circle has:
//   - x, y (px from top-left of canvas)
//   - vx, vy (px per frame)
//   - radius (px)
//   - mass (proportional to radius²)
//   - color, emoji, sounds[]
//
// Collisions: O(n²) circle-circle check (n=12, fine). Walls: clamp + reflect.
// Drag: pointer down = grab, pointer move = move, pointer up = release with
// velocity computed from recent pointer positions.

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { playSingle, stopAllSounds, isAnySoundPlaying } from "./audioManager";

// === Sound definitions ===

interface Circle {
  id: string;
  emoji: string;
  color: string;
  shadow: string;
  hatchEmoji: string;
  sounds: string[];
  // Per-circle config
  radius: number; // base radius in px
  mass: number; // mass for collisions (proportional to radius²)
}

// A user-created circle. The audio lives at blobUrl (an object URL
// created from the recorded Blob). hatchEmoji/color/shadow are unused
// for custom circles (we don't show a settings row for them).
interface CustomCircle {
  id: string; // "c-<timestamp>"
  emoji: string;
  blobUrl: string; // object URL for the recorded audio
  radius: number;
  mass: number;
  createdAt: number;
}

// v40: emojis only, no colored circles. Cream background, physics-driven
// emojis. Each emoji = single object, radius covers physics + hit area + visual.
// All radii >= 30px so tap targets are well above Apple's 44pt minimum on iPhone.
// (Previous version had 32-38px which was too small.)
const CIRCLES: Circle[] = [
  { id: "cow", emoji: "🐄", color: "transparent", shadow: "transparent", hatchEmoji: "🐦", sounds: ["/sounds/cow.mp3", "/sounds/v1/cow.mp3"], radius: 32, mass: 1 },
  { id: "dog", emoji: "🐕", color: "transparent", shadow: "transparent", hatchEmoji: "🦋", sounds: ["/sounds/dog.mp3", "/sounds/v1/dog.mp3"], radius: 30, mass: 1 },
  { id: "cat", emoji: "🐈", color: "transparent", shadow: "transparent", hatchEmoji: "🐟", sounds: ["/sounds/cat.mp3", "/sounds/v1/cat.mp3"], radius: 30, mass: 1 },
  { id: "pig", emoji: "🐖", color: "transparent", shadow: "transparent", hatchEmoji: "🐛", sounds: ["/sounds/pig.mp3", "/sounds/extra/pig.mp3"], radius: 32, mass: 1 },
  { id: "duck", emoji: "🦆", color: "transparent", shadow: "transparent", hatchEmoji: "🐝", sounds: ["/sounds/duck.mp3", "/sounds/v1/duck.mp3"], radius: 30, mass: 1 },
  { id: "lion", emoji: "🦁", color: "transparent", shadow: "transparent", hatchEmoji: "🐞", sounds: ["/sounds/lion.mp3", "/sounds/v1/lion.mp3", "/sounds/extra/lion_long.mp3"], radius: 32, mass: 1 },
  { id: "frog", emoji: "🐸", color: "transparent", shadow: "transparent", hatchEmoji: "🐜", sounds: ["/sounds/frog.mp3", "/sounds/v1/frog.mp3"], radius: 30, mass: 1 },
  { id: "monkey", emoji: "🐒", color: "transparent", shadow: "transparent", hatchEmoji: "🐌", sounds: ["/sounds/monkey.mp3", "/sounds/v1/monkey.mp3"], radius: 30, mass: 1 },
  { id: "horse", emoji: "🐎", color: "transparent", shadow: "transparent", hatchEmoji: "🐢", sounds: ["/sounds/horse.mp3", "/sounds/v1/horse.mp3"], radius: 32, mass: 1 },
  { id: "elephant", emoji: "🐘", color: "transparent", shadow: "transparent", hatchEmoji: "🦄", sounds: ["/sounds/elephant.mp3", "/sounds/v1/elephant.mp3", "/sounds/extra/elephant_long.mp3"], radius: 34, mass: 1 },
  { id: "rooster", emoji: "🐓", color: "transparent", shadow: "transparent", hatchEmoji: "🦜", sounds: ["/sounds/rooster.mp3"], radius: 30, mass: 1 },
  { id: "bear", emoji: "🐻", color: "transparent", shadow: "transparent", hatchEmoji: "🐨", sounds: ["/sounds/bear.mp3"], radius: 32, mass: 1 },
];

// === Physics types ===

interface Vec2 {
  x: number;
  y: number;
}

interface PhysicsCircle extends Circle {
  // Position (px, top-left of viewport)
  pos: Vec2;
  // Velocity (px/frame at 60fps; multiplied by dt to be frame-rate independent)
  vel: Vec2;
  // Last time (performance.now ms) this circle was directly touched by the user
  // (tap, drag, throw, hatch). -1 = never touched.
  lastTouchedAt: number;
  // v40 fix: last time the user RELEASED this circle after a drag/throw.
  // After release, the circle's lastTouchedAt is also set to "now", so
  // we need a separate timestamp to know "this circle was released, any
  // collisions after this point are post-throw chain reactions, not
  // direct user action". A circle is "user-driven" for collision audio
  // only if (now - lastReleasedAt) > 200ms — i.e., a tap is recent
  // AND the user hasn't just released a throw.
  lastReleasedAt: number;
  // Last time the user tapped empty space and this circle was within
  // the tap-push radius.
  lastTapPushedAt: number;
  // Last time this circle was nudged by the random drift tick. Used to
  // make recent drift-driven collisions play sound (so when an emoji is
  // gently floating and bumps another, the kid hears it).
  lastDriftedAt: number;
  // v40: hero circle pulses gently until tapped, drawing the kid's eye
  // to the obvious "tap me" target. Set once at init.
  isHero: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  life: number;
}

interface HatchAnimal {
  id: number;
  x: number;
  y: number;
  emoji: string;
  bornAt: number;
}

// === Settings ===

interface Settings {
  volume: number;
  reducedMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  volume: 0.9,
  reducedMotion: false,
};

const SETTINGS_KEY = "pootbox-settings-v1";
const HIDDEN_LONG_PRESS_MS = 5000;
const HATCH_HOLD_MS = 1500;
const MAX_CUSTOM_CIRCLES = 12;
const MAX_RECORDING_MS = 6000;

// IndexedDB helpers for persisting user recordings.
// We use a single object store with key=id (custom circle id) and value=Blob.
// On app load, all stored recordings are read back and re-attached as
// blob URLs to the custom circles (so playback works after refresh).
const DB_NAME = "pootbox";
const STORE_NAME = "recordings";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveRecording(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort persistence. If IDB fails, the recording still works
    // for the current session.
  }
}

async function loadAllRecordings(): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        // getAll() returns values only — we need keys too. Use openCursor.
        const curReq = tx.objectStore(STORE_NAME).openCursor();
        curReq.onsuccess = () => {
          const cursor = curReq.result;
          if (cursor) {
            out.set(String(cursor.key), cursor.value as Blob);
            cursor.continue();
          }
        };
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort.
  }
  return out;
}

async function deleteRecording(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort.
  }
}

// === Physics constants (v40) ===
//
// v40: stillness by default, satisfying bounces on interaction.
//   - Friction is very low (0.995) — circles coast a long time after
//     a throw. They keep moving until they hit a wall or another circle.
//   - Wall and collision bounces are punchy (0.7) — kids get the
//     satisfying "boing" they expect from a sound toy.
//   - Drift is removed — circles are still until the kid touches them.
const FRICTION = 0.995; // very low friction — coast a long time
const WALL_BOUNCE = 0.7; // punchy wall bounce
const COLLISION_BOUNCE = 0.85; // satisfying circle-circle bounce
const DRAG_THROW_MULTIPLIER = 1.0;
const TAP_PUSH_RADIUS = 130; // smaller push radius
const TAP_PUSH_MAX = 2; // much gentler push (was 6 — ~3x weaker)
// v40 fix: collision sound only fires if the user DIRECTLY touched
// one of the colliding circles in the last 800ms. This stops the
// "ton of random farts" chain reaction that happens when a kid
// throws one circle into a pile and the chain bounces 5-6 times.
// The user-caused collision plays its sound; the chain after that
// is silent (still has visible sparks, but no audio).
const COLLISION_AUDIO_WINDOW_MS = 800;

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...s };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// === Component ===

export default function PootBox() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [hatchAnimals, setHatchAnimals] = useState<HatchAnimal[]>([]);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [hatchedId, setHatchedId] = useState<string | null>(null);
  // v40: hero circle pulses gently until the kid has tapped any circle.
  // After the first tap, the pulse stops. (Hero is the center circle of
  // the 4x3 grid; set in the init useEffect.)
  const [heroTapped, setHeroTapped] = useState(false);
  // v40: track if any sound is currently playing. Polled every 100ms
  // via the audio manager — used to show a "stop" button only when
  // there's something to stop.
  const [soundPlaying, setSoundPlaying] = useState(false);

  // Recording + custom circles
  // Phase: 'idle' = show + button. 'recording' = big mic, hold to capture.
  // 'picking' = show emoji picker. 'previewing' = play back the recording.
  const [recPhase, setRecPhase] = useState<"idle" | "recording" | "picking" | "previewing">("idle");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [customCircles, setCustomCircles] = useState<CustomCircle[]>([]);
  // ID of the custom circle whose delete-X is currently shown (tap to delete)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Refs for animation loop
  const circlesRef = useRef<PhysicsCircle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastShakeAtRef = useRef<number>(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  // Per-circle last-played timestamp. Prevents one tap from triggering
  // multiple sounds on the same circle (e.g. tap → sound, then 50ms later
  // a drift-induced collision fires the same sound again).
  const lastCirclePlayRef = useRef<Map<string, number>>(new Map());

  // Refs for drag
  const dragRef = useRef<{
    id: string;
    lastX: number;
    lastY: number;
    lastT: number;
    velocity: Vec2; // px per ms
  } | null>(null);
  const holdTimers = useRef<Map<string, number>>(new Map());

  // Refs for blank-area long-press (settings backdoor)
  const blankHoldTimer = useRef<number | null>(null);
  const blankHoldStartPos = useRef<Vec2 | null>(null);
  const blankHoldStartT = useRef<number | null>(null);

  // ID generators
  const rippleIdRef = useRef(0);
  const sparkIdRef = useRef(0);
  const hatchIdRef = useRef(0);

  // === Measure canvas ===

  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    const el = canvasRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // === Initialize circle positions ===
  //
  // v40: deterministic initial layout. 4×3 grid with the cow in the
  // center, slightly bigger, gently pulsing. Sago Mini's trick: the
  // first thing the kid sees is one obvious "tap me" target in the
  // middle, with the other 11 arranged around it. Nothing random.
  // Re-init on resize (portrait/landscape flip) since the grid math
  // depends on dimensions.

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    const cols = 4;
    const rows = 3;
    // 12 circles in a 4x3 grid; reserve top/bottom safe-area.
    // The center cell of the middle row is the "hero" cell — that's
    // where the cow goes, with a slight scale-up.
    const heroIndex = 1 * cols + 1; // row 1, col 1 (middle of 4x3)
    const padX = 16;
    const padTop = Math.max(40, size.h * 0.08); // room for status bar
    const padBottom = 80; // room for + button
    const usableH = size.h - padTop - padBottom;
    const cellW = (size.w - padX * 2) / cols;
    const cellH = usableH / rows;

    circlesRef.current = CIRCLES.map((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isHero = i === heroIndex;
      // Slight jitter so it doesn't look like a spreadsheet
      const jx = (col - (cols - 1) / 2) * 6;
      const jy = (row - (rows - 1) / 2) * 4;
      return {
        ...c,
        pos: {
          x: padX + cellW * col + cellW / 2 + jx,
          y: padTop + cellH * row + cellH / 2 + jy,
        },
        // Hero gets tiny initial "breathing" velocity. Others still.
        vel: isHero
          ? { x: 0, y: 0 }
          : { x: 0, y: 0 },
        lastTouchedAt: -1,
        lastReleasedAt: -1,
        lastTapPushedAt: -1,
        lastDriftedAt: -1,
        // Hero pulse for the self-teaching first screen
        isHero,
      };
    });
  }, [size.w, size.h]);

  // === Physics loop ===

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;
      const dt = lastFrameRef.current === 0 ? 16.67 : now - lastFrameRef.current;
      lastFrameRef.current = now;
      // Cap dt to avoid huge jumps when tab is backgrounded
      const clampedDt = Math.min(dt, 50);
      const stepScale = clampedDt / 16.67; // 1.0 = 60fps baseline

      const circles = circlesRef.current;
      const w = size.w;
      const h = size.h;
      const collisionsThisFrame: { a: PhysicsCircle; b: PhysicsCircle }[] = [];

      // 1. Integrate position (v40: stillness by default. Friction is
      // low so throws coast, but nothing moves on its own — only what
      // the kid touched.)
      for (const c of circles) {
        if (dragRef.current?.id === c.id) continue; // dragged circle follows pointer
        c.pos.x += c.vel.x * stepScale;
        c.pos.y += c.vel.y * stepScale;
        // Friction (frame-rate independent) — slows them toward stillness
        const damp = Math.pow(FRICTION, stepScale);
        c.vel.x *= damp;
        c.vel.y *= damp;
        // Stop tiny velocities
        if (Math.abs(c.vel.x) < 0.05) c.vel.x = 0;
        if (Math.abs(c.vel.y) < 0.05) c.vel.y = 0;
      }

      // v40: no periodic drift. Circles stay still until the kid
      // touches them. (Previous versions had a 2.2s random nudge; that
      // looked glitchy to parents and made the kid's tap target move.)

      // 2. Wall collisions — very soft, just keeps them on screen
      for (const c of circles) {
        if (dragRef.current?.id === c.id) continue;
        if (c.pos.x - c.radius < 0) {
          c.pos.x = c.radius;
          c.vel.x = -c.vel.x * WALL_BOUNCE;
        } else if (c.pos.x + c.radius > w) {
          c.pos.x = w - c.radius;
          c.vel.x = -c.vel.x * WALL_BOUNCE;
        }
        if (c.pos.y - c.radius < 0) {
          c.pos.y = c.radius;
          c.vel.y = -c.vel.y * WALL_BOUNCE;
        } else if (c.pos.y + c.radius > h) {
          c.pos.y = h - c.radius;
          c.vel.y = -c.vel.y * WALL_BOUNCE;
        }
      }

      // 3. Circle-circle collisions
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const a = circles[i];
          const b = circles[j];
          const dx = b.pos.x - a.pos.x;
          const dy = b.pos.y - a.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius;
          if (dist < minDist && dist > 0.001) {
            // Normal vector
            const nx = dx / dist;
            const ny = dy / dist;
            // Push apart (positional correction)
            const overlap = (minDist - dist) / 2;
            // If either is being dragged, only push the other
            const aDragged = dragRef.current?.id === a.id;
            const bDragged = dragRef.current?.id === b.id;
            if (!aDragged && !bDragged) {
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
            } else if (aDragged && !bDragged) {
              b.pos.x += nx * overlap;
              b.pos.y += ny * overlap;
            } else if (bDragged && !aDragged) {
              a.pos.x -= nx * overlap;
              a.pos.y -= ny * overlap;
            }
            // Velocity exchange (elastic with damping)
            const aDragged2 = dragRef.current?.id === a.id;
            const bDragged2 = dragRef.current?.id === b.id;
            // If either is dragged, that circle's velocity is treated as zero
            const vaX = aDragged2 ? 0 : a.vel.x;
            const vaY = aDragged2 ? 0 : a.vel.y;
            const vbX = bDragged2 ? 0 : b.vel.x;
            const vbY = bDragged2 ? 0 : b.vel.y;
            // Relative velocity along normal
            const rvx = vbX - vaX;
            const rvy = vbY - vaY;
            const velAlongNormal = rvx * nx + rvy * ny;
            if (velAlongNormal < 0) {
              // Already separating, skip
              continue;
            }
            const restitution = COLLISION_BOUNCE;
            // Equal mass (1) so impulse is just velAlongNormal * (1 + restitution) / 2
            const impulse = (velAlongNormal * (1 + restitution)) / 2;
            if (!aDragged2) {
              a.vel.x += impulse * nx;
              a.vel.y += impulse * ny;
            }
            if (!bDragged2) {
              b.vel.x -= impulse * nx;
              b.vel.y -= impulse * ny;
            }
            collisionsThisFrame.push({ a, b });
          }
        }
      }

      // 4. Play collision sounds + sparks for user-driven collisions.
      // v40 fix: ONLY play sound if the user directly touched one of
      // the colliding circles AND has not just released a throw.
      //
      // "userDriven" requires BOTH:
      //   (a) the circle was touched within COLLISION_AUDIO_WINDOW_MS
      //   (b) the circle has not been released in the last 200ms
      //       (i.e., it's a fresh tap, not the tail end of a throw)
      //
      // Chain-reaction bounces after a release are silent. Sparks
      // still fire on every collision for visual feedback.
      if (collisionsThisFrame.length > 0) {
        for (const { a, b } of collisionsThisFrame) {
          const aTouched = now - a.lastTouchedAt < COLLISION_AUDIO_WINDOW_MS;
          const aReleased = now - a.lastReleasedAt < 200;
          const aUser = aTouched && !aReleased;
          const bTouched = now - b.lastTouchedAt < COLLISION_AUDIO_WINDOW_MS;
          const bReleased = now - b.lastReleasedAt < 200;
          const bUser = bTouched && !bReleased;
          const userDriven = aUser || bUser;
          const key = [a.id, b.id].sort().join("|");
          const last = collisionCooldownRef.current.get(key) ?? 0;
          // Sparks: every collision (visual feedback for the kid)
          spawnSparksAtRef.current(
            (a.pos.x + b.pos.x) / 2,
            (a.pos.y + b.pos.y) / 2,
            a.color
          );
          if (!userDriven) continue; // chain collision — silent
          if (now - last < 250) continue; // tighter cooldown: 250ms
          collisionCooldownRef.current.set(key, now);
          // Play sound on the user-touched circle (or "a" if both)
          const circle = aUser ? a : b;
          playRandomFromCircleRef(circle, settingsRef.current.volume);
        }
      }

      // 5. Force a re-render by bumping a tick counter
      setTick((t) => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // Track settings in a ref for the physics loop
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [, setTick] = useState(0);

  // Per-circle sound cooldown. After a circle plays, it can't play again
  // for ~250ms. This is what stops "tap one emoji → 10 sounds" — the
  // collision step would otherwise keep firing the same sound for as
  // long as the touch window (600ms) is open.
  const PER_CIRCLE_SOUND_COOLDOWN_MS = 250;

  const playRandomFromCircle = useCallback(
    (circle: Circle) => {
      const now = performance.now();
      const last = lastCirclePlayRef.current.get(circle.id) ?? 0;
      if (now - last < PER_CIRCLE_SOUND_COOLDOWN_MS) return;
      lastCirclePlayRef.current.set(circle.id, now);
      const sound = circle.sounds[Math.floor(Math.random() * circle.sounds.length)];
      playSingle(sound, settings.volume);
    },
    [settings.volume]
  );

  // Use ref-stable version for the physics loop
  const playRandomFromCircleRef = useCallback(
    (circle: Circle, volume: number) => {
      const now = performance.now();
      const last = lastCirclePlayRef.current.get(circle.id) ?? 0;
      if (now - last < PER_CIRCLE_SOUND_COOLDOWN_MS) return;
      lastCirclePlayRef.current.set(circle.id, now);
      const sound = circle.sounds[Math.floor(Math.random() * circle.sounds.length)];
      playSingle(sound, volume);
    },
    []
  );

  const spawnSparksAt = useCallback((x: number, y: number, color: string) => {
    const newSparks: Spark[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      newSparks.push({
        id: ++sparkIdRef.current,
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color,
        life: 600,
      });
    }
    setSparks((prev) => [...prev, ...newSparks]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => !newSparks.find((ns) => ns.id === s.id)));
    }, 600);
  }, []);

  const spawnSparksAtRef = useRef(spawnSparksAt);
  spawnSparksAtRef.current = spawnSparksAt;

  // === Ripple ===

  const spawnRipple = useCallback((circle: Circle, x: number, y: number) => {
    const id = ++rippleIdRef.current;
    setRipples((prev) => [...prev, { id, x, y, color: circle.color }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  }, []);

  // === Hatch ===

  const spawnHatch = useCallback((circle: Circle, x: number, y: number) => {
    setHatchedId(circle.id);
    setTimeout(() => setHatchedId(null), 800);
    // 8 burst particles
    const newSparks: Spark[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 6 + Math.random() * 4;
      newSparks.push({
        id: ++sparkIdRef.current,
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: circle.color,
        life: 800,
      });
    }
    setSparks((prev) => [...prev, ...newSparks]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => !newSparks.find((ns) => ns.id === s.id)));
    }, 800);
    // Hatched animal
    const hatch: HatchAnimal = {
      id: ++hatchIdRef.current,
      x,
      y,
      emoji: circle.hatchEmoji,
      bornAt: Date.now(),
    };
    setHatchAnimals((prev) => [...prev, hatch]);
    setTimeout(() => {
      setHatchAnimals((prev) => prev.filter((h) => h.id !== hatch.id));
    }, 3000);
  }, []);

  // === Shake detection ===

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > 22) {
        const now = Date.now();
        if (now - lastShakeAtRef.current < 1000) return;
        lastShakeAtRef.current = now;
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        // Apply random impulse to all circles (gentle — they should ripple
        // around like water, not explode). Marked as touched so the resulting
        // collisions make sound.
        for (const c of circlesRef.current) {
          c.vel.x += (Math.random() - 0.5) * 5;
          c.vel.y += (Math.random() - 0.5) * 5;
          c.lastTouchedAt = now;
        }
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, []);

  // === iOS audio unlock ===
  //
  // iOS Safari blocks `new Audio().play()` until a user gesture has
  // "unlocked" the audio context. The first user tap is the gesture,
  // but the first `play()` call on that gesture can still fail silently
  // if the audio context isn't fully unlocked. The standard fix is to
  // play a silent (or near-silent) buffer on the first user tap, before
  // any real sound needs to play. This runs once and then becomes a no-op.
  const audioUnlockedRef = useRef(false);
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      // Create a 0.01s silent WAV. play() with volume 0.0 still
      // triggers the iOS audio context unlock.
      const silent = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      );
      silent.volume = 0.0;
      void silent.play().catch(() => {
        // If even the silent buffer fails, try again on the next gesture
        audioUnlockedRef.current = false;
      });
    } catch {
      audioUnlockedRef.current = false;
    }
  }, []);

  // === Recording: MediaRecorder setup ===
  // Held in refs (not state) because they're mutable objects we don't
  // want React to re-render on. The UI listens to recPhase state instead.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      // iOS Safari produces audio/mp4. Other browsers default to webm.
      // Pick whatever MediaRecorder supports.
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        // Build the blob + object URL
        const blob = new Blob(mediaChunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setPendingBlob(blob);
        setPendingUrl(url);
        setRecPhase("picking");
        // Stop the mic stream
        if (mediaStreamRef.current) {
          for (const t of mediaStreamRef.current.getTracks()) t.stop();
          mediaStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
      };
      rec.start();
      mediaRecorderRef.current = rec;
      recordingStartRef.current = performance.now();
      setRecordingMs(0);
      setRecPhase("recording");
      // Tick the recording timer so the UI shows the live duration
      recordingTimerRef.current = window.setInterval(() => {
        const ms = performance.now() - recordingStartRef.current;
        setRecordingMs(ms);
        // Auto-stop at max
        if (ms >= MAX_RECORDING_MS) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          if (recordingTimerRef.current) {
            window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
        }
      }, 50);
    } catch (err) {
      // User denied mic permission, or browser doesn't support getUserMedia
      setRecPhase("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      // Stop but don't save the result
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      for (const t of mediaStreamRef.current.getTracks()) t.stop();
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setPendingBlob(null);
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingUrl(null);
    setRecordingMs(0);
    setRecPhase("idle");
  }, [pendingUrl]);

  // Pick an emoji for the pending recording → drops a new circle onto the canvas
  const completeRecordingWithEmoji = useCallback(
    (emoji: string) => {
      if (!pendingBlob || !pendingUrl) return;
      const id = `c-${Date.now()}`;
      const newCircle: CustomCircle = {
        id,
        emoji,
        blobUrl: pendingUrl,
        radius: 36,
        mass: 1,
        createdAt: Date.now(),
      };
      // Persist the recording to IndexedDB
      void saveRecording(id, pendingBlob);
      setCustomCircles((prev) => [...prev, newCircle]);
      // Spawn the new circle with a small drop-in velocity
      if (size.w > 0 && size.h > 0) {
        const x = newCircle.radius + Math.random() * (size.w - newCircle.radius * 2);
        const y = newCircle.radius + Math.random() * (size.h - newCircle.radius * 2);
        const ang = Math.random() * Math.PI * 2;
        const speed = 0.1 + Math.random() * 0.2;
        circlesRef.current.push({
          ...newCircle,
          color: "transparent",
          shadow: "transparent",
          hatchEmoji: "✨",
          sounds: [pendingUrl],
          pos: { x, y },
          vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
          lastTouchedAt: -1,
          lastReleasedAt: -1,
          lastTapPushedAt: -1,
          lastDriftedAt: -1,
          isHero: false,
        });
        setTick((t) => (t + 1) % 1000000);
      }
      setPendingBlob(null);
      setPendingUrl(null);
      setRecordingMs(0);
      setRecPhase("idle");
    },
    [pendingBlob, pendingUrl, size.w, size.h]
  );

  // Delete a custom circle
  const deleteCustomCircle = useCallback(
    (id: string) => {
      const c = customCircles.find((x) => x.id === id);
      if (c) {
        URL.revokeObjectURL(c.blobUrl);
        void deleteRecording(id);
      }
      setCustomCircles((prev) => prev.filter((x) => x.id !== id));
      circlesRef.current = circlesRef.current.filter((c) => c.id !== id);
      if (deleteTarget === id) setDeleteTarget(null);
      setTick((t) => (t + 1) % 1000000);
    },
    [customCircles, deleteTarget]
  );

  // On mount, restore any saved custom circles from IndexedDB
  useEffect(() => {
    void loadAllRecordings().then((map) => {
      if (map.size === 0) return;
      // We don't have emoji metadata stored (only Blobs), so we use a
      // generic 🎤 placeholder. Future improvement: store emoji too.
      const restored: CustomCircle[] = [];
      for (const [id, blob] of map.entries()) {
        const url = URL.createObjectURL(blob);
        restored.push({
          id,
          emoji: "🎤",
          blobUrl: url,
          radius: 36,
          mass: 1,
          createdAt: 0,
        });
      }
      setCustomCircles(restored);
    });
  }, []);

  // v40: poll the audio manager every 100ms so the "stop" button
  // appears only when there's actually a sound playing. setInterval
  // is fine here — we're not driving animation off this.
  useEffect(() => {
    const id = window.setInterval(() => {
      const playing = isAnySoundPlaying();
      setSoundPlaying((prev) => (prev !== playing ? playing : prev));
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // === Drag handlers ===

  const onCirclePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      if (target.setPointerCapture && e.pointerId !== undefined) {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      setPressedId(id);

      // v40: first tap dismisses the hero pulse — kid has discovered
      // the app, no more hand-holding.
      if (!heroTapped) setHeroTapped(true);

      // iOS audio unlock on first touch (idempotent, no-op on others)
      unlockAudio();

      const circle = circlesRef.current.find((c) => c.id === id);
      if (!circle) return;

      // Mark touched (used to gate collision sounds — see physics loop)
      circle.lastTouchedAt = performance.now();

      // Play sound on touch-down (gives iOS instant feedback)
      playRandomFromCircle(circle);
      spawnRipple(circle, e.clientX, e.clientY);

      // Set up drag
      dragRef.current = {
        id,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: { x: 0, y: 0 },
      };
      // Stop the circle's existing motion while held
      circle.vel.x = 0;
      circle.vel.y = 0;

      // Set up hold-to-hatch timer
      const existing = holdTimers.current.get(id);
      if (existing) window.clearTimeout(existing);
      const timerId = window.setTimeout(() => {
        // Hatched
        spawnHatch(circle, circle.pos.x, circle.pos.y);
        playRandomFromCircle(circle);
        holdTimers.current.delete(id);
      }, HATCH_HOLD_MS);
      holdTimers.current.set(id, timerId);
    },
    [playRandomFromCircle, spawnRipple, spawnHatch]
  );

  const onCirclePointerMove = useCallback(
    (id: string, e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id) return;
      const circle = circlesRef.current.find((c) => c.id === id);
      if (!circle) return;

      // Track velocity (px per ms)
      const now = performance.now();
      // Keep lastTouchedAt fresh while the user is dragging
      circle.lastTouchedAt = now;
      const dt = now - drag.lastT;
      if (dt > 0) {
        // Smoothed velocity
        const instVx = (e.clientX - drag.lastX) / dt;
        const instVy = (e.clientY - drag.lastY) / dt;
        drag.velocity.x = drag.velocity.x * 0.6 + instVx * 0.4;
        drag.velocity.y = drag.velocity.y * 0.6 + instVy * 0.4;
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;

      // Move circle to follow pointer (convert client coords to canvas coords)
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      circle.pos.x = e.clientX - rect.left;
      circle.pos.y = e.clientY - rect.top;
    },
    []
  );

  const onCirclePointerUp = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPressedId(null);

      // Cancel hold timer
      const timer = holdTimers.current.get(id);
      if (timer) {
        window.clearTimeout(timer);
        holdTimers.current.delete(id);
      }

      const drag = dragRef.current;
      if (drag && drag.id === id) {
        const circle = circlesRef.current.find((c) => c.id === id);
        if (circle) {
          // If the user didn't drag (or barely moved), this counts as a tap
          // on a custom circle → show the delete-X badge.
          const totalDist = Math.sqrt(
            (e.clientX - drag.lastX) ** 2 + (e.clientY - drag.lastY) ** 2
          );
          // For drag, the lastX/Y is updated every move, so totalDist
          // is the distance from the last move to the up point. A tap
          // has small totalDist.
          if (totalDist < 8 && circle.id.startsWith("c-")) {
            setDeleteTarget(circle.id);
          }
          // Throw with velocity from drag (px/ms → px/frame at 60fps)
          circle.vel.x = drag.velocity.x * 16.67 * DRAG_THROW_MULTIPLIER;
          circle.vel.y = drag.velocity.y * 16.67 * DRAG_THROW_MULTIPLIER;
          // Keep lastTouchedAt fresh on release so the throw's collisions
          // still count as user-initiated for the TOUCH_RECENT_MS window.
          circle.lastTouchedAt = performance.now();
          // v40 fix: also mark as just-released. From this point on,
          // collisions are chain reactions, not direct user action —
          // see the userDriven check in the physics loop.
          circle.lastReleasedAt = performance.now();
        }
        dragRef.current = null;
      }
    },
    []
  );

  const onCirclePointerCancel = useCallback((id: string) => {
    setPressedId(null);
    const timer = holdTimers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      holdTimers.current.delete(id);
    }
    if (dragRef.current?.id === id) {
      const circle = circlesRef.current.find((c) => c.id === id);
      if (circle) circle.lastTouchedAt = performance.now();
      dragRef.current = null;
    }
  }, []);

  // === Blank-area long-press for settings ===

  const onBlankPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-circle]")) return;

    // iOS audio unlock on first touch (idempotent)
    unlockAudio();

    // Tap on empty space clears any lingering delete-X badge
    if (deleteTarget) setDeleteTarget(null);

    // Radial push: any circle within TAP_PUSH_RADIUS gets pushed away
    // from the tap point, scaled by inverse distance. Marked as
    // tap-pushed so the resulting collisions make sound.
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const tx = e.clientX - rect.left;
      const ty = e.clientY - rect.top;
      const now = performance.now();
      for (const c of circlesRef.current) {
        const dx = c.pos.x - tx;
        const dy = c.pos.y - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < TAP_PUSH_RADIUS && dist > 0.001) {
          const ramp = 1 - dist / TAP_PUSH_RADIUS; // 1 at center, 0 at edge
          const push = TAP_PUSH_MAX * ramp;
          c.vel.x += (dx / dist) * push;
          c.vel.y += (dy / dist) * push;
          c.lastTapPushedAt = now;
        }
      }
    }

    blankHoldStartPos.current = { x: e.clientX, y: e.clientY };
    blankHoldStartT.current = Date.now();
    if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
    blankHoldTimer.current = window.setTimeout(() => {
      setShowSettings(true);
      blankHoldTimer.current = null;
    }, HIDDEN_LONG_PRESS_MS);
  }, [unlockAudio, deleteTarget]);

  const onBlankPointerMove = useCallback((e: React.PointerEvent) => {
    if (!blankHoldStartPos.current) return;
    const dx = Math.abs(e.clientX - blankHoldStartPos.current.x);
    const dy = Math.abs(e.clientY - blankHoldStartPos.current.y);
    if (dx > 25 || dy > 25) {
      if (blankHoldTimer.current) {
        window.clearTimeout(blankHoldTimer.current);
        blankHoldTimer.current = null;
      }
      blankHoldStartPos.current = null;
    }
  }, []);

  const onBlankPointerUp = useCallback(() => {
    if (blankHoldTimer.current) {
      window.clearTimeout(blankHoldTimer.current);
      blankHoldTimer.current = null;
    }
    blankHoldStartPos.current = null;
  }, []);

  // === Cleanup ===

  useEffect(() => {
    return () => {
      for (const timer of holdTimers.current.values()) {
        window.clearTimeout(timer);
      }
      holdTimers.current.clear();
      if (blankHoldTimer.current) {
        window.clearTimeout(blankHoldTimer.current);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // === Render ===

  return (
    <div
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
        touchAction: "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        overflow: "hidden",
        fontFamily: 'Fredoka, system-ui, sans-serif',
      }}
      onPointerDown={onBlankPointerDown}
      onPointerMove={onBlankPointerMove}
      onPointerUp={onBlankPointerUp}
      onPointerCancel={onBlankPointerUp}
    >
      {/* Render circles */}
      {circlesRef.current.map((c) => (
        <CircleButton
          key={c.id}
          circle={c}
          pressed={pressedId === c.id}
          hatched={hatchedId === c.id}
          shaking={shaking}
          reducedMotion={settings.reducedMotion}
          showHeroPulse={c.isHero && !heroTapped}
          onPointerDown={onCirclePointerDown}
          onPointerMove={onCirclePointerMove}
          onPointerUp={onCirclePointerUp}
          onPointerCancel={onCirclePointerCancel}
        />
      ))}

      {/* Ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
            borderRadius: "50%",
            border: `4px solid ${r.color}`,
            transform: "translate(-50%, -50%)",
            animation: "pootbox-ripple 0.7s ease-out forwards",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      ))}

      {/* Sparks (collision + hatch) */}
      {sparks.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: s.color,
            transform: "translate(-50%, -50%)",
            animation: "pootbox-spark 0.6s ease-out forwards",
            ["--dx" as string]: `${s.dx * 12}px`,
            ["--dy" as string]: `${s.dy * 12}px`,
            pointerEvents: "none",
            zIndex: 11,
            boxShadow: `0 0 8px ${s.color}`,
          }}
        />
      ))}

      {/* Hatched animals */}
      {hatchAnimals.map((h) => (
        <div
          key={h.id}
          style={{
            position: "absolute",
            left: h.x,
            top: h.y,
            fontSize: "2.4rem",
            transform: "translate(-50%, -50%)",
            animation: "pootbox-bob 3s ease-in-out forwards",
            pointerEvents: "none",
            zIndex: 12,
          }}
        >
          {h.emoji}
        </div>
      ))}

      {/* Tiny corner 💨 watermark */}
      <div
        style={{
          position: "fixed",
          bottom: "max(8px, env(safe-area-inset-bottom))",
          right: 12,
          fontSize: "1.4rem",
          opacity: 0.35,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        💨
      </div>

      {/* v40: Stop button — visible only when a sound is currently
          playing. Tapping it silences everything immediately. */}
      {soundPlaying && (
        <button
          data-stop-button
          onClick={() => {
            stopAllSounds();
            setSoundPlaying(false);
          }}
          aria-label="Stop sound"
          style={{
            position: "fixed",
            top: `calc(16px + env(safe-area-inset-top))`,
            left: 16,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            fontSize: "1.1rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            zIndex: 60,
            WebkitTapHighlightColor: "transparent",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          ⏹
        </button>
      )}

      {/* Add button — only when idle and we have room for more */}
      {recPhase === "idle" && customCircles.length < MAX_CUSTOM_CIRCLES && (
        <button
          data-add-button
          onClick={() => {
            unlockAudio();
            void startRecording();
          }}
          aria-label="Add your own sound"
          style={{
            position: "fixed",
            bottom: `calc(20px + env(safe-area-inset-bottom))`,
            right: 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: "1.8rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            color: "#3D2C1E",
            zIndex: 50,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          ＋
        </button>
      )}

      {/* Stop button — appears when any sound is currently playing.
          Tapping it silences all audio without leaving the app. */}
      {isAnySoundPlaying() && (
        <button
          data-stop-sound
          onClick={stopAllSounds}
          aria-label="Stop all sounds"
          style={{
            position: "fixed",
            bottom: `calc(20px + env(safe-area-inset-bottom))`,
            right: customCircles.length < MAX_CUSTOM_CIRCLES ? 88 : 20,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(255,82,82,0.95)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 16px rgba(255,82,82,0.35)",
            fontSize: "1.4rem",
            lineHeight: 1,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            color: "white",
            zIndex: 50,
            WebkitTapHighlightColor: "transparent",
            animation: "pootbox-pulse-stop 1s ease-in-out infinite",
          }}
        >
          ⏹
        </button>
      )}

      {/* Delete-X badge on a tapped custom circle */}
      {deleteTarget && (() => {
        const target = circlesRef.current.find((c) => c.id === deleteTarget);
        if (!target) return null;
        return (
          <button
            data-delete-target
            onClick={(e) => {
              e.stopPropagation();
              deleteCustomCircle(deleteTarget);
            }}
            aria-label="Delete this sound"
            style={{
              position: "absolute",
              left: target.pos.x + target.radius * 0.7,
              top: target.pos.y - target.radius * 0.7,
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#FF5252",
              color: "white",
              border: "2px solid white",
              fontSize: "0.85rem",
              lineHeight: 1,
              fontWeight: 700,
              cursor: "pointer",
              zIndex: 30,
              padding: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ×
          </button>
        );
      })()}

      {/* Recording UI */}
      {recPhase === "recording" && (
        <div
          data-rec-overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "1.1rem",
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            {recordingMs > 0 ? "Recording…" : "Get ready…"}
          </div>
          <div
            data-mic-button
            aria-label="Recording"
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: recordingMs > 0 ? "#FF5252" : "white",
              border: "none",
              fontSize: "4.5rem",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              boxShadow:
                recordingMs > 0
                  ? "0 0 0 16px rgba(255,82,82,0.25), 0 8px 32px rgba(0,0,0,0.3)"
                  : "0 8px 32px rgba(0,0,0,0.3)",
              transform: recordingMs > 0 ? "scale(1.08)" : "scale(1)",
              transition: "transform 100ms ease-out, box-shadow 100ms ease-out",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            🎙
          </div>
          <div
            style={{
              color: "white",
              fontSize: "0.95rem",
              fontFamily: "monospace",
              opacity: 0.7,
            }}
          >
            {(recordingMs / 1000).toFixed(1)}s / 6.0s
          </div>
          <button
            data-stop-rec
            onClick={stopRecording}
            disabled={recordingMs === 0}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              color: "white",
              fontSize: "0.95rem",
              padding: "10px 20px",
              borderRadius: 14,
              cursor: recordingMs > 0 ? "pointer" : "not-allowed",
              opacity: recordingMs > 0 ? 1 : 0.4,
              fontFamily: "inherit",
            }}
          >
            ✓ Done
          </button>
          <button
            data-cancel-rec
            onClick={cancelRecording}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.85rem",
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Emoji picker (after recording finishes) */}
      {recPhase === "picking" && (
        <div
          data-emoji-picker
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            style={{
              color: "white",
              fontSize: "1.1rem",
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            Pick an emoji
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 8,
              maxWidth: 320,
            }}
          >
            {[
              "🎤", "🎸", "🥁", "🎺", "🎹", "🎷",
              "🐶", "🐱", "🐰", "🦊", "🐻", "🐼",
              "🦁", "🐯", "🐸", "🐵", "🐔", "🦆",
              "🐮", "🐷", "🐭", "🐹", "🐨", "🦄",
              "⭐", "🌈", "🔥", "💧", "🌸", "🍕",
            ].map((em) => (
              <button
                key={em}
                data-emoji-option={em}
                onClick={() => completeRecordingWithEmoji(em)}
                style={{
                  appearance: "none",
                  border: "none",
                  background: "rgba(255,255,255,0.95)",
                  borderRadius: 12,
                  fontSize: "1.7rem",
                  lineHeight: 1,
                  padding: "10px 0",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {em}
              </button>
            ))}
          </div>
          <button
            data-redo-rec
            onClick={() => {
              if (pendingUrl) URL.revokeObjectURL(pendingUrl);
              setPendingUrl(null);
              setPendingBlob(null);
              setRecordingMs(0);
              void startRecording();
            }}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              color: "white",
              fontSize: "0.95rem",
              padding: "10px 20px",
              borderRadius: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ↺ Re-record
          </button>
          <button
            data-cancel-pick
            onClick={cancelRecording}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.85rem",
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={(s) => {
            setSettings(s);
            saveSettings(s);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes pootbox-ripple {
          0% { width: 0; height: 0; opacity: 0.8; }
          100% { width: 200px; height: 200px; opacity: 0; }
        }
        @keyframes pootbox-spark {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.3); opacity: 0; }
        }
        @keyframes pootbox-bob {
          0% { transform: translate(-50%, -50%) scale(0); }
          15% { transform: translate(-50%, -50%) scale(1.3); }
          25% { transform: translate(-50%, -50%) scale(1); }
          75% { transform: translate(calc(-50% + 40px), calc(-50% - 60px)) scale(1) rotate(15deg); }
          100% { transform: translate(calc(-50% + 60px), calc(-50% - 30px)) scale(0.6) rotate(-10deg); opacity: 0.5; }
        }
        @keyframes pootbox-pulse-stop {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes pootbox-hero-pulse {
          0%, 100% { transform: scale(1.05); }
          50% { transform: scale(1.18); }
        }
        @keyframes pootbox-hero-ring {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.25); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

// === Single circle button ===

interface CircleButtonProps {
  circle: PhysicsCircle;
  pressed: boolean;
  hatched: boolean;
  shaking: boolean;
  reducedMotion: boolean;
  /** True when this is the "hero" circle that the kid hasn't tapped yet
   *  on the first screen — pulses gently to draw the eye. */
  showHeroPulse: boolean;
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onPointerMove: (id: string, e: React.PointerEvent) => void;
  onPointerUp: (id: string, e: React.PointerEvent) => void;
  onPointerCancel: (id: string) => void;
}

function CircleButton({
  circle,
  pressed,
  hatched,
  shaking,
  reducedMotion,
  showHeroPulse,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CircleButtonProps) {
  // v33: emojis only. Emoji IS the button. radius → font size + hit area.
  const size = circle.radius * 2;
  // Hero circle: tap target slightly larger + subtle pulse animation.
  // Once tapped, hero flag is cleared by parent (showHeroPulse=false)
  // and the pulse stops. This is the "self-teaching" trick.
  const heroScale = showHeroPulse ? 1.15 : 1;
  return (
    <button
      data-circle={circle.id}
      onPointerDown={(e) => onPointerDown(circle.id, e)}
      onPointerMove={(e) => onPointerMove(circle.id, e)}
      onPointerUp={(e) => onPointerUp(circle.id, e)}
      onPointerCancel={() => onPointerCancel(circle.id)}
      aria-label={`${circle.id} sound`}
      style={{
        appearance: "none",
        border: "none",
        background: "transparent",
        cursor: "grab",
        position: "absolute",
        left: circle.pos.x - circle.radius,
        top: circle.pos.y - circle.radius,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${pressed ? 0.88 : hatched ? 1.25 : heroScale})`,
        transition: pressed
          ? "transform 100ms ease-out"
          : "transform 200ms ease-out",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        padding: 0,
        animation: showHeroPulse && !reducedMotion
          ? "pootbox-hero-pulse 1.6s ease-in-out infinite"
          : shaking && !reducedMotion
          ? "pootbox-jiggle 0.6s ease-in-out"
          : undefined,
        zIndex: pressed ? 20 : showHeroPulse ? 5 : 1,
        userSelect: "none",
      }}
    >
      {/* Soft glow ring around the hero circle, only when not yet tapped */}
      {showHeroPulse && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            border: "2px dashed rgba(245, 158, 11, 0.55)",
            pointerEvents: "none",
            animation: "pootbox-hero-ring 1.6s ease-in-out infinite",
          }}
        />
      )}
      <span
        style={{
          fontSize: `${circle.radius * 1.4}px`, // emoji bigger than hit area for finger forgiveness
          lineHeight: 1,
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.12))",
          pointerEvents: "none",
        }}
      >
        {circle.emoji}
      </span>
    </button>
  );
}

// === Settings modal (backdoor) ===

interface SettingsModalProps {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 24,
          padding: 24,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#3D2C1E",
          }}
        >
          💨 PootBox
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "0.85rem",
            color: "#92705A",
          }}
        >
          Parent settings (hidden)
        </p>

        <label style={{ display: "block", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
              fontSize: "0.9rem",
              color: "#3D2C1E",
            }}
          >
            <span>Volume</span>
            <span style={{ fontFamily: "monospace" }}>
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) =>
              onChange({ ...settings, volume: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#F59E0B" }}
          />
        </label>

        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            padding: "8px 0",
          }}
        >
          <span style={{ fontSize: "0.9rem", color: "#3D2C1E" }}>Reduce motion</span>
          <button
            onClick={() => onChange({ ...settings, reducedMotion: !settings.reducedMotion })}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              width: 48,
              height: 28,
              borderRadius: 14,
              background: settings.reducedMotion ? "#F59E0B" : "#E5E0D5",
              position: "relative",
              transition: "background 200ms",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: settings.reducedMotion ? 22 : 2,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "white",
                transition: "left 200ms",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </label>

        <button
          onClick={onClose}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            padding: "12px 0",
            borderRadius: 16,
            background: "#F59E0B",
            color: "white",
            fontSize: "1rem",
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          Done
        </button>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: "0.7rem",
            color: "#92705A",
            textAlign: "center",
          }}
        >
          This menu only appears after holding the background for 5 seconds.
        </p>
      </div>
    </div>
  );
}



