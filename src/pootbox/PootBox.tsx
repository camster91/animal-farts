// PootBox — minimal sound toy for kids. v37.
//
// v37: "floating in water" mode. Toned down everything.
//      Stronger friction, smaller deadzone, gentler taps, half throws.
// v36: gyroscope (tilt) drift + tap-empty-to-push. More inputs, same rule.
// v35: zero-G floating.
// v34: staggered drop-in.
// v33: emojis on cream background.
// v32: physics-based drag/throw/collide.
// v31: grid layout.
//
// 4 user inputs, all "user-driven":
//   1. Tap emoji        → its sound
//   2. Drag/throw emoji → it + any circle it bumps (gentler throw)
//   3. Hold emoji 1.5s  → hatches a small animal
//   4. Tilt phone       → emojis drift (gentle, wider deadzone)
//   5. Tap empty space  → soft radial push from tap point
//   6. Shake phone      → ripple (small impulse)
//
// Pure drift between two resting emojis is silent. Water-floating feel.
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

// v33: emojis only, no colored circles. Cream background, physics-driven
// emojis. Each emoji = single object, radius covers physics + hit area + visual.
// (Previous version had separate "color circle" + emoji; v33 drops the circle.)
const CIRCLES: Circle[] = [
  { id: "cow", emoji: "🐄", color: "transparent", shadow: "transparent", hatchEmoji: "🐦", sounds: ["/sounds/cow.mp3", "/sounds/v1/cow.mp3"], radius: 36, mass: 1 },
  { id: "dog", emoji: "🐕", color: "transparent", shadow: "transparent", hatchEmoji: "🦋", sounds: ["/sounds/dog.mp3", "/sounds/v1/dog.mp3"], radius: 34, mass: 1 },
  { id: "cat", emoji: "🐈", color: "transparent", shadow: "transparent", hatchEmoji: "🐟", sounds: ["/sounds/cat.mp3", "/sounds/v1/cat.mp3"], radius: 34, mass: 1 },
  { id: "pig", emoji: "🐖", color: "transparent", shadow: "transparent", hatchEmoji: "🐛", sounds: ["/sounds/pig.mp3", "/sounds/extra/pig.mp3"], radius: 36, mass: 1 },
  { id: "duck", emoji: "🦆", color: "transparent", shadow: "transparent", hatchEmoji: "🐝", sounds: ["/sounds/duck.mp3", "/sounds/v1/duck.mp3"], radius: 32, mass: 1 },
  { id: "lion", emoji: "🦁", color: "transparent", shadow: "transparent", hatchEmoji: "🐞", sounds: ["/sounds/lion.mp3", "/sounds/v1/lion.mp3", "/sounds/extra/lion_long.mp3"], radius: 36, mass: 1 },
  { id: "frog", emoji: "🐸", color: "transparent", shadow: "transparent", hatchEmoji: "🐜", sounds: ["/sounds/frog.mp3", "/sounds/v1/frog.mp3"], radius: 34, mass: 1 },
  { id: "monkey", emoji: "🐒", color: "transparent", shadow: "transparent", hatchEmoji: "🐌", sounds: ["/sounds/monkey.mp3", "/sounds/v1/monkey.mp3"], radius: 34, mass: 1 },
  { id: "horse", emoji: "🐎", color: "transparent", shadow: "transparent", hatchEmoji: "🐢", sounds: ["/sounds/horse.mp3", "/sounds/v1/horse.mp3"], radius: 36, mass: 1 },
  { id: "elephant", emoji: "🐘", color: "transparent", shadow: "transparent", hatchEmoji: "🦄", sounds: ["/sounds/elephant.mp3", "/sounds/v1/elephant.mp3", "/sounds/extra/elephant_long.mp3"], radius: 38, mass: 1 },
  { id: "rooster", emoji: "🐓", color: "transparent", shadow: "transparent", hatchEmoji: "🦜", sounds: ["/sounds/rooster.mp3"], radius: 34, mass: 1 },
  { id: "bear", emoji: "🐻", color: "transparent", shadow: "transparent", hatchEmoji: "🐨", sounds: ["/sounds/bear.mp3"], radius: 36, mass: 1 },
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
  // Last time the phone was tilted and this circle was affected by the tilt.
  // Tracks whether recent collision is "user-driven" via tilt.
  lastTiltedAt: number;
  // Last time the user tapped empty space and this circle was within
  // the tap-push radius.
  lastTapPushedAt: number;
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
const FRICTION = 0.94; // stronger friction — settles faster in zero-g
const WALL_BOUNCE = 0.05; // almost no wall bounce, just barely a nudge
const COLLISION_BOUNCE = 0.08; // very soft push — feels like jelly, not balls
const DRAG_THROW_MULTIPLIER = 0.5; // half-strength throws
const TILT_DEADZONE = 12; // wider deadzone — only real tilts register
const TILT_MAX_DEG = 60; // need a bigger tilt to max out
const TILT_DRIFT_MAX = 0.18; // very gentle drift (was 0.7 — ~4x weaker)
const TILT_RECENT_MS = 600; // collision sound window
const TOUCH_RECENT_MS = 500; // collision sound window
const TAP_PUSH_RADIUS = 130; // smaller push radius
const TAP_PUSH_MAX = 2; // much gentler push (was 6 — ~3x weaker)
const TAP_PUSH_RECENT_MS = 350;

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

  // Refs for animation loop
  const circlesRef = useRef<PhysicsCircle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastShakeAtRef = useRef<number>(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  // Current phone tilt (radians, from DeviceOrientationEvent).
  // beta = front-back tilt, gamma = left-right tilt. 0 = flat.
  // Updated by the orientation listener; read by the physics loop.
  const tiltRef = useRef<{ beta: number; gamma: number; hasPermission: boolean }>({
    beta: 0,
    gamma: 0,
    hasPermission: false,
  });

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

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    // v35: zero-g drift. No drop, no settle. Each emoji starts somewhere
    // on the canvas with a small random velocity, so they float and
    // gently nudge each other out of the way.
    // Skip if already initialized (rotation / resize shouldn't reset).
    if (circlesRef.current.length > 0) return;
    circlesRef.current = CIRCLES.map((c) => {
      // Random position anywhere in the canvas (with padding so circles aren't half off-screen)
      const x = c.radius + Math.random() * (size.w - c.radius * 2);
      const y = c.radius + Math.random() * (size.h - c.radius * 2);
      // Tiny initial velocity — water-floating, not darting around
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.2;
      return {
        ...c,
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        lastTouchedAt: -1,
        lastTiltedAt: -1,
        lastTapPushedAt: -1,
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

      // 1. Integrate position (zero-G: no gravity, just velocity + friction)
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

      // 1.5 Tilt drift — phone tilt becomes a global acceleration vector.
      // No tilt = no force. Tilt above TILT_DEADZONE = linear ramp up to
      // TILT_DRIFT_MAX at TILT_MAX_DEG. Below deadzone = completely silent
      // (so a hand-held-but-level phone doesn't drift).
      const tilt = tiltRef.current;
      const absBeta = Math.abs(tilt.beta);
      const absGamma = Math.abs(tilt.gamma);
      const totalTilt = absBeta + absGamma;
      if (totalTilt > TILT_DEADZONE) {
        // Linear ramp: 0 at deadzone, 1 at maxDeg
        const ramp = Math.min(
          1,
          (totalTilt - TILT_DEADZONE) / Math.max(1, TILT_MAX_DEG - TILT_DEADZONE)
        );
        // Direction: sign of gamma = x, sign of beta = y (portrait phone)
        // Tilt right (gamma > 0) → drift right (+x). Tilt forward (beta > 0) → drift down (+y).
        const ax = Math.sign(tilt.gamma) * TILT_DRIFT_MAX * ramp * stepScale;
        const ay = Math.sign(tilt.beta) * TILT_DRIFT_MAX * ramp * stepScale;
        for (const c of circles) {
          if (dragRef.current?.id === c.id) continue;
          c.vel.x += ax;
          c.vel.y += ay;
          c.lastTiltedAt = now;
        }
      }

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

      // 4. Play collision sounds when a user is driving the motion —
      // either direct touch (tap/drag/throw/hatch), tilt (the user is
      // angling the phone), or tap-push (user poked empty space).
      // Pure drift between two resting emojis is silent and spark-less.
      if (collisionsThisFrame.length > 0) {
        for (const { a, b } of collisionsThisFrame) {
          const aUser =
            now - a.lastTouchedAt < TOUCH_RECENT_MS ||
            now - a.lastTiltedAt < TILT_RECENT_MS ||
            now - a.lastTapPushedAt < TAP_PUSH_RECENT_MS;
          const bUser =
            now - b.lastTouchedAt < TOUCH_RECENT_MS ||
            now - b.lastTiltedAt < TILT_RECENT_MS ||
            now - b.lastTapPushedAt < TAP_PUSH_RECENT_MS;
          if (!aUser && !bUser) continue; // silent drift
          const key = [a.id, b.id].sort().join("|");
          const last = collisionCooldownRef.current.get(key) ?? 0;
          if (now - last < 400) continue; // 400ms per-pair cooldown
          collisionCooldownRef.current.set(key, now);
          // Play sound on the user-driven circle(s) only
          if (aUser) playRandomFromCircleRef(a, settingsRef.current.volume);
          if (bUser) playRandomFromCircleRef(b, settingsRef.current.volume);
          // Spark if user is driving (visual confirmation)
          if (aUser || bUser) {
            spawnSparksAtRef.current(
              (a.pos.x + b.pos.x) / 2,
              (a.pos.y + b.pos.y) / 2,
              a.color
            );
          }
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

  const playRandomFromCircle = useCallback(
    (circle: Circle) => {
      const sound = circle.sounds[Math.floor(Math.random() * circle.sounds.length)];
      playSingle(sound, settings.volume);
    },
    [settings.volume]
  );

  // Use ref-stable version for the physics loop
  const playRandomFromCircleRef = useCallback(
    (circle: Circle, volume: number) => {
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

  // === Tilt (deviceorientation) — drives the drift vector ===
  //
  // iOS Safari 13+ requires explicit user permission to read deviceorientation.
  // We request it lazily on the first user interaction (a tap on the canvas
  // anywhere). On Android/desktop/no-permission-needed, the listener just works.
  //
  // beta: front-back tilt in degrees (-180..180, 0 = flat on a table)
  // gamma: left-right tilt in degrees (-90..90, 0 = flat)
  // Portrait phone, held upright, screen toward user:
  //   - tilt right (right side down) → gamma goes positive
  //   - tilt forward (top of phone away) → beta goes positive
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      tiltRef.current.beta = e.beta;
      tiltRef.current.gamma = e.gamma;
    };
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, []);

  // iOS-specific permission request. Called from a user gesture (first touch).
  const requestOrientationPermission = useCallback(async () => {
    const cls = (window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<"granted" | "denied"> };
    }).DeviceOrientationEvent;
    if (cls && typeof cls.requestPermission === "function") {
      try {
        const result = await cls.requestPermission();
        tiltRef.current.hasPermission = result === "granted";
      } catch {
        tiltRef.current.hasPermission = false;
      }
    } else {
      // Non-iOS or already-granted: assume permission is implicit
      tiltRef.current.hasPermission = true;
    }
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

      // Request iOS tilt permission on first touch (idempotent, no-op on others)
      if (!tiltRef.current.hasPermission) {
        void requestOrientationPermission();
      }

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
          // Throw with velocity from drag (px/ms → px/frame at 60fps)
          circle.vel.x = drag.velocity.x * 16.67 * DRAG_THROW_MULTIPLIER;
          circle.vel.y = drag.velocity.y * 16.67 * DRAG_THROW_MULTIPLIER;
          // Keep lastTouchedAt fresh on release so the throw's collisions
          // still count as user-initiated for the TOUCH_RECENT_MS window.
          circle.lastTouchedAt = performance.now();
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

    // Request iOS tilt permission on first touch (idempotent)
    if (!tiltRef.current.hasPermission) {
      void requestOrientationPermission();
    }

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
  }, [requestOrientationPermission]);

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
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CircleButtonProps) {
  // v33: emojis only. Emoji IS the button. radius → font size + hit area.
  const size = circle.radius * 2;
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
        transform: `scale(${pressed ? 0.88 : hatched ? 1.25 : 1})`,
        transition: pressed
          ? "transform 100ms ease-out"
          : "transform 200ms ease-out",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        padding: 0,
        animation: shaking && !reducedMotion ? "pootbox-jiggle 0.6s ease-in-out" : undefined,
        zIndex: pressed ? 20 : 1,
        userSelect: "none",
      }}
    >
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


// === Audio (single voice — stop and play) ===
//
// Sound toy for kids. To prevent the audio from becoming a wall of
// overlapping chaos when many circles bump at the same time, we
// enforce a single-voice policy: when a new sound wants to play,
// we stop ALL currently-playing sounds first, then start the new
// one. Each tap or collision is its own distinct sound — no two
// sounds ever overlap.

const activeAudioElements = new Set<HTMLAudioElement>();

function playSingle(sound: string, volume: number): void {
  // Stop any currently playing sounds
  for (const a of activeAudioElements) {
    try {
      a.pause();
    } catch {
      // ignore
    }
  }
  activeAudioElements.clear();

  const a = new Audio(sound);
  a.volume = volume;
  const remove = () => {
    activeAudioElements.delete(a);
  };
  a.addEventListener("ended", remove, { once: true });
  a.addEventListener("error", remove, { once: true });
  // Hard safety net: if 'ended' never fires, remove after 10s
  setTimeout(remove, 10_000);
  activeAudioElements.add(a);
  a.play().catch(() => {
    remove();
  });
}
