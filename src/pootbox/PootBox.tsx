// PootBox — minimal sound toy for kids. v31.
//
// One screen. Tap colored circles to make sounds. Hold to grow
// them and "hatch" an animal. Shake the device for bonus fun.
// No levels, no progress, no goals. Just sounds.
//
// Built for Sago Mini Sound Box-style minimalism:
//   - 12 colored ovals, cream background
//   - Tap = play random sound from the oval's pool + ripple animation
//   - Hold = oval grows from scale 1.0 to 2.0 over ~1.5s while cycling sounds
//   - At max size, oval "hatches" — splits into 8 small circles + a small
//     bouncing animal appears in the middle
//   - Shake (devicemotion) = all ovals jiggle briefly
//   - Hidden settings: tap-hold-5s on blank area opens a tiny settings modal
//
// Replaces the old Poot Party scene-loop app. This is the v31 rewrite.

import { useState, useEffect, useRef, useCallback } from "react";

// === Sound definitions ===
//
// Each circle has 2-3 sounds. Tap picks one at random.
// The pool is small on purpose — kids tap fast and need variety,
// but not so much they never know which one they're hearing.
//
// 12 circles: 8 animals + 4 surprise (mix of animals + silly sounds).
// Sounds come from /public/sounds/ — already on disk.

interface Circle {
  id: string;
  emoji: string;
  color: string;
  shadow: string;
  sounds: string[];
  hatchEmoji: string;
}

const CIRCLES: Circle[] = [
  {
    id: "cow",
    emoji: "🐄",
    color: "#FFD66B",
    shadow: "rgba(255, 214, 107, 0.4)",
    sounds: ["/sounds/cow.mp3", "/sounds/v1/cow.mp3"],
    hatchEmoji: "🐦",
  },
  {
    id: "dog",
    emoji: "🐕",
    color: "#FF9FB5",
    shadow: "rgba(255, 159, 181, 0.4)",
    sounds: ["/sounds/dog.mp3", "/sounds/v1/dog.mp3"],
    hatchEmoji: "🦋",
  },
  {
    id: "cat",
    emoji: "🐈",
    color: "#A8D8FF",
    shadow: "rgba(168, 216, 255, 0.4)",
    sounds: ["/sounds/cat.mp3", "/sounds/v1/cat.mp3"],
    hatchEmoji: "🐟",
  },
  {
    id: "pig",
    emoji: "🐖",
    color: "#B4E5C2",
    shadow: "rgba(180, 229, 194, 0.4)",
    sounds: ["/sounds/pig.mp3", "/sounds/extra/pig.mp3"],
    hatchEmoji: "🐛",
  },
  {
    id: "duck",
    emoji: "🦆",
    color: "#D4BFFF",
    shadow: "rgba(212, 191, 255, 0.4)",
    sounds: ["/sounds/duck.mp3", "/sounds/v1/duck.mp3"],
    hatchEmoji: "🐝",
  },
  {
    id: "lion",
    emoji: "🦁",
    color: "#FFB890",
    shadow: "rgba(255, 184, 144, 0.4)",
    sounds: ["/sounds/lion.mp3", "/sounds/v1/lion.mp3", "/sounds/extra/lion_long.mp3"],
    hatchEmoji: "🐞",
  },
  {
    id: "frog",
    emoji: "🐸",
    color: "#FFD66B",
    shadow: "rgba(255, 214, 107, 0.4)",
    sounds: ["/sounds/frog.mp3", "/sounds/v1/frog.mp3"],
    hatchEmoji: "🐜",
  },
  {
    id: "monkey",
    emoji: "🐒",
    color: "#FF9FB5",
    shadow: "rgba(255, 159, 181, 0.4)",
    sounds: ["/sounds/monkey.mp3", "/sounds/v1/monkey.mp3"],
    hatchEmoji: "🐌",
  },
  {
    id: "horse",
    emoji: "🐎",
    color: "#A8D8FF",
    shadow: "rgba(168, 216, 255, 0.4)",
    sounds: ["/sounds/horse.mp3", "/sounds/v1/horse.mp3"],
    hatchEmoji: "🐢",
  },
  {
    id: "elephant",
    emoji: "🐘",
    color: "#B4E5C2",
    shadow: "rgba(180, 229, 194, 0.4)",
    sounds: ["/sounds/elephant.mp3", "/sounds/v1/elephant.mp3", "/sounds/extra/elephant_long.mp3"],
    hatchEmoji: "🦄",
  },
  {
    id: "rooster",
    emoji: "🐓",
    color: "#D4BFFF",
    shadow: "rgba(212, 191, 255, 0.4)",
    sounds: ["/sounds/rooster.mp3"],
    hatchEmoji: "🦜",
  },
  {
    id: "bear",
    emoji: "🐻",
    color: "#FFB890",
    shadow: "rgba(255, 184, 144, 0.4)",
    sounds: ["/sounds/bear.mp3"],
    hatchEmoji: "🐨",
  },
];

// === Hatch burst (8 small circles that fly out) ===

interface Burst {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
}

interface HatchAnimal {
  id: number;
  x: number;
  y: number;
  emoji: string;
  bornAt: number;
}

// === Settings backdoor ===

interface Settings {
  volume: number; // 0..1
  reducedMotion: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  volume: 0.9,
  reducedMotion: false,
};

const SETTINGS_KEY = "pootbox-settings-v1";
const HIDDEN_LONG_PRESS_MS = 5000;

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
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [hatchAnimals, setHatchAnimals] = useState<HatchAnimal[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const holdTimers = useRef<Map<string, number>>(new Map());
  const holdStartRef = useRef<number | null>(null);
  const holdStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const rippleIdRef = useRef(0);
  const hatchIdRef = useRef(0);
  const burstIdRef = useRef(0);
  const hatchedCirclesRef = useRef<Set<string>>(new Set());

  // Apply volume on mount + when changed
  useEffect(() => {
    // engine doesn't have setVolume; we set it per-play. See playRandom below.
  }, [settings.volume]);

  // Shake-to-jiggle
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > 22) {
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, []);

  const playRandomFromCircle = useCallback(
    (circle: Circle) => {
      const sound = circle.sounds[Math.floor(Math.random() * circle.sounds.length)];
      const a = new Audio(sound);
      a.volume = settings.volume;
      a.play().catch(() => {
        // Best-effort: if the play is rejected, the error reporter will catch it
      });
    },
    [settings.volume]
  );

  const spawnRipple = useCallback((circle: Circle, e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const id = ++rippleIdRef.current;
    setRipples((prev) => [
      ...prev,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top, color: circle.color },
    ]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  }, []);

  const spawnBurst = useCallback((circle: Circle, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const newBursts: Burst[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = 60 + Math.random() * 40;
      newBursts.push({
        id: ++burstIdRef.current,
        x: cx,
        y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: circle.color,
      });
    }
    setBursts((prev) => [...prev, ...newBursts]);
    setTimeout(() => {
      setBursts((prev) => prev.filter((b) => !newBursts.find((nb) => nb.id === b.id)));
    }, 800);

    // Spawn the hatched animal
    const hatch: HatchAnimal = {
      id: ++hatchIdRef.current,
      x: cx,
      y: cy,
      emoji: circle.hatchEmoji,
      bornAt: Date.now(),
    };
    setHatchAnimals((prev) => [...prev, hatch]);
    setTimeout(() => {
      setHatchAnimals((prev) => prev.filter((h) => h.id !== hatch.id));
    }, 3000);
  }, []);

  // === Tap / hold handlers per circle ===

  const onCirclePointerDown = useCallback(
    (circle: Circle, e: React.PointerEvent) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      if (target.setPointerCapture && e.pointerId !== undefined) {
        try {
          target.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      // Cancel any previous hold timer for this circle
      const existing = holdTimers.current.get(circle.id);
      if (existing) window.clearTimeout(existing);

      // Play sound immediately on tap-down (better iOS feel)
      playRandomFromCircle(circle);
      spawnRipple(circle, e);

      // Schedule hold-to-hatch
      const timerId = window.setTimeout(() => {
        // Hatched! Spawn burst + animal, mark this circle as just-hatched
        const rect = target.getBoundingClientRect();
        spawnBurst(circle, rect);
        hatchedCirclesRef.current.add(circle.id);
        // Allow re-hatching after 1 second
        setTimeout(() => {
          hatchedCirclesRef.current.delete(circle.id);
        }, 1000);
        // Play one more sound on hatch
        playRandomFromCircle(circle);
        // Clear timer
        holdTimers.current.delete(circle.id);
      }, 1500);

      holdTimers.current.set(circle.id, timerId);
    },
    [playRandomFromCircle, spawnRipple, spawnBurst]
  );

  const onCirclePointerUp = useCallback(
    (circle: Circle, e: React.PointerEvent) => {
      e.preventDefault();
      const timer = holdTimers.current.get(circle.id);
      if (timer) {
        window.clearTimeout(timer);
        holdTimers.current.delete(circle.id);
      }
    },
    []
  );

  const onCirclePointerCancel = useCallback((circle: Circle) => {
    const timer = holdTimers.current.get(circle.id);
    if (timer) {
      window.clearTimeout(timer);
      holdTimers.current.delete(circle.id);
    }
  }, []);

  // === Hidden settings: tap-hold-5s on blank area ===

  const onBlankPointerDown = useCallback((e: React.PointerEvent) => {
    // Don't trigger on circle taps
    if ((e.target as HTMLElement).closest("[data-circle]")) return;
    holdStartRef.current = Date.now();
    holdStartPos.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setShowSettings(true);
      longPressTimer.current = null;
    }, HIDDEN_LONG_PRESS_MS);
  }, []);

  const onBlankPointerUp = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    holdStartRef.current = null;
    holdStartPos.current = null;
  }, []);

  const onBlankPointerMove = useCallback((e: React.PointerEvent) => {
    // Cancel if finger moves more than 20px (scrolling, etc.)
    if (!holdStartPos.current) return;
    const dx = Math.abs(e.clientX - holdStartPos.current.x);
    const dy = Math.abs(e.clientY - holdStartPos.current.y);
    if (dx > 20 || dy > 20) {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      holdStartPos.current = null;
    }
  }, []);

  // === Cleanup ===

  useEffect(() => {
    return () => {
      // Clear all hold timers on unmount
      for (const timer of holdTimers.current.values()) {
        window.clearTimeout(timer);
      }
      holdTimers.current.clear();
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // === Render ===

  return (
    <div
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
      onPointerUp={onBlankPointerUp}
      onPointerMove={onBlankPointerMove}
      onPointerCancel={onBlankPointerUp}
    >
      {/* 12 circles in 4x3 grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(3, 1fr)",
          gap: "clamp(8px, 2vw, 16px)",
          padding: "clamp(12px, 3vw, 24px)",
        }}
      >
        {CIRCLES.map((circle) => (
          <CircleButton
            key={circle.id}
            circle={circle}
            shaking={shaking}
            reducedMotion={settings.reducedMotion}
            onPointerDown={onCirclePointerDown}
            onPointerUp={onCirclePointerUp}
            onPointerCancel={onCirclePointerCancel}
          />
        ))}
      </div>

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

      {/* Hatch bursts */}
      {bursts.map((b) => (
        <div
          key={b.id}
          style={{
            position: "fixed",
            left: b.x,
            top: b.y,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: b.color,
            transform: "translate(-50%, -50%)",
            animation: `pootbox-burst 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
            // CSS variables consumed by keyframes
            ["--dx" as string]: `${b.dx}px`,
            ["--dy" as string]: `${b.dy}px`,
            pointerEvents: "none",
            zIndex: 11,
          }}
        />
      ))}

      {/* Hatched animals */}
      {hatchAnimals.map((h) => (
        <div
          key={h.id}
          style={{
            position: "fixed",
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

      {/* Settings modal (backdoor) */}
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

      {/* Inline keyframes (we don't have a CSS file to add these to) */}
      <style>{`
        @keyframes pootbox-ripple {
          0% { width: 0; height: 0; opacity: 0.8; }
          100% { width: 200px; height: 200px; opacity: 0; }
        }
        @keyframes pootbox-burst {
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
        @keyframes pootbox-jiggle {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.08) rotate(-3deg); }
          50% { transform: scale(1.05) rotate(3deg); }
          75% { transform: scale(1.1) rotate(-2deg); }
        }
        @keyframes pootbox-pop {
          0% { transform: scale(1); }
          40% { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// === Single circle button ===

interface CircleButtonProps {
  circle: Circle;
  shaking: boolean;
  reducedMotion: boolean;
  onPointerDown: (c: Circle, e: React.PointerEvent) => void;
  onPointerUp: (c: Circle, e: React.PointerEvent) => void;
  onPointerCancel: (c: Circle) => void;
}

function CircleButton({
  circle,
  shaking,
  reducedMotion,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: CircleButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-circle={circle.id}
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown(circle, e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp(circle, e);
      }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => {
        setPressed(false);
        onPointerCancel(circle);
      }}
      aria-label={`${circle.id} sound`}
      style={{
        appearance: "none",
        border: "none",
        background: circle.color,
        borderRadius: "32%",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: pressed
          ? `0 2px 8px ${circle.shadow}, inset 0 2px 8px rgba(0,0,0,0.1)`
          : `0 8px 24px ${circle.shadow}, inset 0 -4px 0 rgba(0,0,0,0.08)`,
        transform: pressed
          ? "scale(0.94) translateY(2px)"
          : shaking
            ? undefined
            : "scale(1)",
        transition: "transform 120ms ease-out, box-shadow 120ms ease-out",
        touchAction: "none",
        WebkitTapHighlightColor: "transparent",
        padding: 0,
        animation: shaking && !reducedMotion ? "pootbox-jiggle 0.6s ease-in-out" : undefined,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: "clamp(2.5rem, 10vw, 4.5rem)",
          lineHeight: 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
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

        {/* Volume slider */}
        <label
          style={{
            display: "block",
            marginBottom: 16,
          }}
        >
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
            style={{
              width: "100%",
              accentColor: "#F59E0B",
            }}
          />
        </label>

        {/* Reduced motion toggle */}
        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            padding: "8px 0",
          }}
        >
          <span style={{ fontSize: "0.9rem", color: "#3D2C1E" }}>
            Reduce motion
          </span>
          <button
            onClick={() =>
              onChange({ ...settings, reducedMotion: !settings.reducedMotion })
            }
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
          Kids can't find it.
        </p>
      </div>
    </div>
  );
}
