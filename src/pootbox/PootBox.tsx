// PootBox — minimal sound toy for kids. v41.
//
// v41: split into focused files. Added tap feedback, onboarding screen,
//      triple-tap watermark for settings, bigger + button, error boundary
//      around physics loop, edge case fixes, footer.
// v40: emojis only, no colored circles. Cream background, physics-driven.
// v39: add your own sound + emoji. Hold the + button → mic overlay.
// v38: removed gyroscope. Drift is now a small random nudge every 2.2s.
// v37: floating-in-water mode. Toned down everything.
// v36: gyroscope (tilt) drift + tap-empty-to-push.
// v35: zero-G floating.
// v34: staggered drop-in.
// v33: emojis on cream background.
// v32: physics-based drag/throw/collide.
// v31: grid layout.
//
// Sound definitions (CIRCLES) live in ./constants.
// Physics constants live in ./constants.
// IndexedDB helpers live in ./recordings.
// Audio manager lives in ./audioManager.
// Settings modal lives in ./SettingsModal.

/* eslint-disable react-hooks/refs, react-hooks/purity, react-hooks/immutability */

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { playSingle, stopAllSounds, isAnySoundPlaying } from "./audioManager";
import type {
  Circle,
  CustomCircle,
  PhysicsCircle,
  Vec2,
  Ripple,
  Spark,
  Settings,
  CircleButtonProps,
} from "./types";
import {
  CIRCLES,
  HIDDEN_LONG_PRESS_MS,
  MAX_CUSTOM_CIRCLES,
  MAX_RECORDING_MS,
  FRICTION,
  WALL_BOUNCE,
  COLLISION_BOUNCE,
  DRAG_THROW_MULTIPLIER,
  COLLISION_AUDIO_WINDOW_MS,
  loadSettings,
  saveSettings,
} from "./constants";
import {
  saveRecording,
  loadAllRecordings,
  deleteRecording,
  saveRecordingEmoji,
  loadRecordingEmojis,
  deleteRecordingEmoji,
} from "./recordings";
import SettingsModal from "./SettingsModal";

// === Component ===

export default function PootBox() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [pressedId, setPressedId] = useState<string | null>(null);
  // v40: hero circle pulses gently until the kid has tapped any circle.
  const [heroTapped, setHeroTapped] = useState(false);
  // v40: track if any sound is currently playing.
  const [soundPlaying, setSoundPlaying] = useState(false);

  // Recording + custom circles
  const [recPhase, setRecPhase] = useState<"idle" | "recording" | "picking">("idle");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);
  const [customCircles, setCustomCircles] = useState<CustomCircle[]>([]);
  // ID of the custom circle whose delete-X is currently shown
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // v43: tap combo — count rapid taps within 800ms. At thresholds
  // (5+, 10+), the whole canvas gets a "combo glow" and sparkles
  // spawn. Combo resets when no tap happens within the window.
  const [comboCount, setComboCount] = useState(0);
  const comboCountRef = useRef(0); // ref mirror of comboCount for read inside click handler
  const [comboBurst, setComboBurst] = useState<{ x: number; y: number; n: number } | null>(null);
  const lastTapAtRef = useRef(0);
  const comboResetTimerRef = useRef<number | null>(null);

  // v43: tap total — fires confetti on every 10th tap (cumulative
  // session counter, not per-circle). Just visual delight, no game state.
  // We keep a ref (not state) for the tap handler; the confetti counter
  // (state) is what triggers the actual UI render.
  const lifetimeTapsRef = useRef(0);
  const [confettiBurst, setConfettiBurst] = useState(0); // increments to trigger a new burst

  // Onboarding: first-time users see a full-screen overlay
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return !!localStorage.getItem("pootbox-onboarded-v1");
    } catch {
      return false;
    }
  });

  // Long-press for footer (opens settings)
  const footerHoldTimer = useRef<number | null>(null);

  // Refs for animation loop
  const circlesRef = useRef<PhysicsCircle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastShakeAtRef = useRef<number>(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  const lastCirclePlayRef = useRef<Map<string, number>>(new Map());

  // Refs for drag
  const dragRef = useRef<{
    id: string;
    lastX: number;
    lastY: number;
    lastT: number;
    velocity: Vec2;
  } | null>(null);

  // Refs for blank-area long-press (settings backdoor)
  const blankHoldTimer = useRef<number | null>(null);
  const blankHoldStartPos = useRef<Vec2 | null>(null);
  const blankHoldStartT = useRef<number | null>(null);

  // ID generators
  const rippleIdRef = useRef(0);
  const sparkIdRef = useRef(0);

  // Track settings in a ref for the physics loop
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [, setTick] = useState(0);

  // Per-circle sound cooldown
  const PER_CIRCLE_SOUND_COOLDOWN_MS = 250;

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
    const cols = 4;
    const rows = 3;
    const heroIndex = 1 * cols + 1;
    const padX = 16;
    const padTop = Math.max(40, size.h * 0.08);
    const padBottom = 80;
    const usableH = size.h - padTop - padBottom;
    const cellW = (size.w - padX * 2) / cols;
    const cellH = usableH / rows;

    circlesRef.current = CIRCLES.map((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const isHero = i === heroIndex;
      const jx = (col - (cols - 1) / 2) * 6;
      const jy = (row - (rows - 1) / 2) * 4;
      return {
        ...c,
        pos: {
          x: padX + cellW * col + cellW / 2 + jx,
          y: padTop + cellH * row + cellH / 2 + jy,
        },
        vel: { x: 0, y: 0 },
        lastTouchedAt: -1,
        lastReleasedAt: -1,
        lastDriftedAt: -1,
        isHero,
      };
    });
  }, [size.w, size.h]);

  // === Physics loop ===

  // Ref-stable version for the physics loop. Must be declared before the
  // useEffect that references it inside tick().
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

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let mounted = true;
    let loopStopped = false;

    const tick = (now: number) => {
      if (!mounted || loopStopped) return;
      try {
        const dt = lastFrameRef.current === 0 ? 16.67 : now - lastFrameRef.current;
        lastFrameRef.current = now;
        const clampedDt = Math.min(dt, 50);
        const stepScale = clampedDt / 16.67;

        const circles = circlesRef.current;
        const w = size.w;
        const h = size.h;
        const collisionsThisFrame: { a: PhysicsCircle; b: PhysicsCircle }[] = [];

        for (const c of circles) {
          if (dragRef.current?.id === c.id) continue;
          c.pos.x += c.vel.x * stepScale;
          c.pos.y += c.vel.y * stepScale;
          const damp = Math.pow(FRICTION, stepScale);
          c.vel.x *= damp;
          c.vel.y *= damp;
          if (Math.abs(c.vel.x) < 0.05) c.vel.x = 0;
          if (Math.abs(c.vel.y) < 0.05) c.vel.y = 0;
        }

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

        for (let i = 0; i < circles.length; i++) {
          for (let j = i + 1; j < circles.length; j++) {
            const a = circles[i];
            const b = circles[j];
            const dx = b.pos.x - a.pos.x;
            const dy = b.pos.y - a.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = a.radius + b.radius;
            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = (minDist - dist) / 2;
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
              const aDragged2 = dragRef.current?.id === a.id;
              const bDragged2 = dragRef.current?.id === b.id;
              const vaX = aDragged2 ? 0 : a.vel.x;
              const vaY = aDragged2 ? 0 : a.vel.y;
              const vbX = bDragged2 ? 0 : b.vel.x;
              const vbY = bDragged2 ? 0 : b.vel.y;
              const rvx = vbX - vaX;
              const rvy = vbY - vaY;
              const velAlongNormal = rvx * nx + rvy * ny;
              if (velAlongNormal < 0) continue;
              const restitution = COLLISION_BOUNCE;
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
            spawnSparksAtRef.current(
              (a.pos.x + b.pos.x) / 2,
              (a.pos.y + b.pos.y) / 2,
              a.color
            );
            if (!userDriven) continue;
            if (now - last < 250) continue;
            collisionCooldownRef.current.set(key, now);
            const circle = aUser ? a : b;
            playRandomFromCircleRef(circle, settingsRef.current.volume);
          }
        }

        setTick((t) => (t + 1) % 1000000);
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error("Physics loop error:", err);
        loopStopped = true;
        // Circles become static; kid can still tap to play sounds
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

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

  const audioUnlockedRef = useRef(false);
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      const silent = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
      );
      silent.volume = 0.0;
      void silent.play().catch(() => {
        audioUnlockedRef.current = false;
      });
    } catch {
      audioUnlockedRef.current = false;
    }
  }, []);

  // === Recording: MediaRecorder setup ===

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);

  // Mic permission denied state (Task 6.2)
  // v42: track WHY mic is blocked so the banner can tell the kid's parent
  // exactly what to do. Three states:
  //   - "prompt"   : browser hasn't decided, we need to call getUserMedia
  //   - "denied"   : user said no (or browser auto-denied); show reset hint
  //   - "granted"  : all good
  //   - "unsupported" : no Permissions API or no mediaDevices
  type MicPermState = "prompt" | "denied" | "granted" | "unsupported";
  // v42: on app mount, query the Permissions API to learn the current
  // state. If "denied", we know Chrome will auto-reject getUserMedia
  // without showing a dialog. Surface that to the user immediately.
  //
  // We can't use a state setter inside the effect (it would cause a
  // re-render warning). Instead, the state is initialized via the
  // async query and updated via the change listener.
  const [micPermState, setMicPermState] = useState<MicPermState>("prompt");
  const [micDenied, setMicDenied] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    // Initial query
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (cancelled) return;
        const initialState = p.state as MicPermState;
        // Use a microtask to avoid setState-in-effect warnings
        queueMicrotask(() => {
          if (cancelled) return;
          setMicPermState(initialState);
          if (initialState === "denied") setMicDenied(true);
        });
        // Listen for changes (user toggles Chrome settings)
        p.addEventListener("change", () => {
          if (cancelled) return;
          const newState = p.state as MicPermState;
          setMicPermState(newState);
          if (newState === "granted") setMicDenied(false);
          else if (newState === "denied") setMicDenied(true);
        });
      })
      .catch(() => {
        // Some browsers (Firefox) don't support querying mic permission
        // — that's fine, we'll fall through to the prompt flow.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current) return;
    // Pre-check: if Chrome has already denied mic permission, don't
    // even bother with getUserMedia — it would just silently fail.
    // Instead, show the user the reset-instructions banner.
    if (micPermState === "denied") {
      setMicDenied(true);
      return;
    }
    // IMPORTANT: getUserMedia must be called synchronously in a user
    // gesture. Do NOT call anything else that might "consume" the
    // gesture (like new Audio().play()) before this.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setMicDenied(true);
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        // No microphone found
        setMicDenied(true);
      } else {
        // Other error (security, hardware, etc.)
        console.error("Recording error:", err);
        setMicDenied(true);
      }
      setRecPhase("idle");
      return;
    }
    mediaStreamRef.current = stream;
    setMicDenied(false);
    // Now (after getUserMedia) is safe to call unlockAudio and
    // initialize MediaRecorder.
    unlockAudio();
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
      // Task 6.4: check for empty recording
      const blob = new Blob(mediaChunksRef.current, {
        type: rec.mimeType || "audio/webm",
      });
      if (mediaChunksRef.current.length === 0 || blob.size === 0) {
        setRecPhase("idle");
        return;
      }
      const url = URL.createObjectURL(blob);
      setPendingBlob(blob);
      setPendingUrl(url);
      setRecPhase("picking");
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
  }, [unlockAudio, micPermState]);
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

  // Task 6.3: beforeunload to cancel recording
  useEffect(() => {
    const handler = () => {
      if (recPhase === "recording") cancelRecording();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [recPhase, cancelRecording]);

  const completeRecordingWithEmoji = useCallback(
    (emoji: string) => {
      if (!pendingBlob || !pendingUrl) return;
      const id = `c-${Date.now()}`;
      const newCircle: CustomCircle = {
        id,
        emoji,
        blobUrl: pendingUrl,
        radius: 32,
        mass: 1,
        createdAt: Date.now(),
      };
      void saveRecording(id, pendingBlob);
      saveRecordingEmoji(id, emoji);
      setCustomCircles((prev) => [...prev, newCircle]);
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

  const deleteCustomCircle = useCallback(
    (id: string) => {
      const c = customCircles.find((x) => x.id === id);
      if (c) {
        URL.revokeObjectURL(c.blobUrl);
        void deleteRecording(id);
        deleteRecordingEmoji(id);
      }
      setCustomCircles((prev) => prev.filter((x) => x.id !== id));
      circlesRef.current = circlesRef.current.filter((c) => c.id !== id);
      if (deleteTarget === id) setDeleteTarget(null);
      setTick((t) => (t + 1) % 1000000);
    },
    [customCircles, deleteTarget]
  );

  // On mount, restore saved custom circles
  useEffect(() => {
    const emojiMap = loadRecordingEmojis();
    void loadAllRecordings().then((map) => {
      if (map.size === 0) return;
      const restored: CustomCircle[] = [];
      for (const [id, blob] of map.entries()) {
        const url = URL.createObjectURL(blob);
        const emoji = emojiMap[id] || "🎤";
        restored.push({ id, emoji, blobUrl: url, radius: 32, mass: 1, createdAt: 0 });
      }
      setCustomCircles(restored);
    });
  }, []);

  // Poll audio manager every 100ms for stop button
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
        } catch { /* ignore */ }
      }
      setPressedId(id);

      if (!heroTapped) setHeroTapped(true);
      unlockAudio();

      const circle = circlesRef.current.find((c) => c.id === id);
      if (!circle) return;

      circle.lastTouchedAt = performance.now();
      playRandomFromCircle(circle);
      spawnRipple(circle, e.clientX, e.clientY);

      // v43: combo system. Rapid taps (within 800ms) build a combo.
      // At 5+ a sutil gold tint kicks in; at 10+ a burst of stars
      // + the tapped circle does a 1.4x scale pulse. Combo decays after
      // 800ms of no taps.
      const now = performance.now();
      let newCombo: number;
      if (now - lastTapAtRef.current < 800) {
        newCombo = comboCountRef.current + 1;
        setComboCount(newCombo);
      } else {
        newCombo = 1;
        setComboCount(1);
      }
      comboCountRef.current = newCombo;
      lastTapAtRef.current = now;
      if (comboResetTimerRef.current) {
        window.clearTimeout(comboResetTimerRef.current);
      }
      comboResetTimerRef.current = window.setTimeout(() => {
        setComboCount(0);
        comboCountRef.current = 0;
        comboResetTimerRef.current = null;
      }, 800);
      // Burst on combo milestones (5, 10, 15...)
      if (newCombo > 0 && newCombo % 5 === 0) {
        setComboBurst({ x: e.clientX, y: e.clientY, n: newCombo });
        setTimeout(() => setComboBurst(null), 700);
      }

      // v43: confetti on every 10th tap. Pure visual delight.
      const newLifetime = lifetimeTapsRef.current + 1;
      lifetimeTapsRef.current = newLifetime;
      if (newLifetime % 10 === 0) {
        setConfettiBurst((c) => c + 1);
      }

      dragRef.current = {
        id,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: { x: 0, y: 0 },
      };
      circle.vel.x = 0;
      circle.vel.y = 0;
    },
    [playRandomFromCircle, spawnRipple, heroTapped, unlockAudio]
  );

  const onCirclePointerMove = useCallback(
    (id: string, e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.id !== id) return;
      const circle = circlesRef.current.find((c) => c.id === id);
      if (!circle) return;

      const now = performance.now();
      circle.lastTouchedAt = now;
      const dt = now - drag.lastT;
      if (dt > 0) {
        const instVx = (e.clientX - drag.lastX) / dt;
        const instVy = (e.clientY - drag.lastY) / dt;
        drag.velocity.x = drag.velocity.x * 0.6 + instVx * 0.4;
        drag.velocity.y = drag.velocity.y * 0.6 + instVy * 0.4;
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;

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

      const drag = dragRef.current;
      if (drag && drag.id === id) {
        const circle = circlesRef.current.find((c) => c.id === id);
        if (circle) {
          const totalDist = Math.sqrt(
            (e.clientX - drag.lastX) ** 2 + (e.clientY - drag.lastY) ** 2
          );
          if (totalDist < 8 && circle.id.startsWith("c-")) {
            setDeleteTarget(circle.id);
          }
          circle.vel.x = drag.velocity.x * 16.67 * DRAG_THROW_MULTIPLIER;
          circle.vel.y = drag.velocity.y * 16.67 * DRAG_THROW_MULTIPLIER;
          circle.lastTouchedAt = performance.now();
          circle.lastReleasedAt = performance.now();
        }
        dragRef.current = null;
      }
    },
    []
  );

  const onCirclePointerCancel = useCallback((id: string) => {
    setPressedId(null);
    if (dragRef.current?.id === id) {
      const circle = circlesRef.current.find((c) => c.id === id);
      if (circle) circle.lastTouchedAt = performance.now();
      dragRef.current = null;
    }
  }, []);

  // === Blank-area long-press for settings ===

  const onBlankPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-circle]")) return;

    unlockAudio();
    if (deleteTarget) setDeleteTarget(null);

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
    const blankTimerRef = blankHoldTimer;
    const rafRefLocal = rafRef;
    return () => {
      if (blankTimerRef.current) {
        window.clearTimeout(blankTimerRef.current);
      }
      if (rafRefLocal.current) cancelAnimationFrame(rafRefLocal.current);
    };
  }, []);

  // === Footer long-press handler (opens settings) ===

  const handleFooterPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    if (target.setPointerCapture && e.pointerId !== undefined) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch { /* ignore */ }
    }
    if (footerHoldTimer.current) window.clearTimeout(footerHoldTimer.current);
    footerHoldTimer.current = window.setTimeout(() => {
      setShowSettings(true);
      footerHoldTimer.current = null;
    }, 1500);
  }, []);

  const handleFooterPointerUp = useCallback(() => {
    if (footerHoldTimer.current) {
      window.clearTimeout(footerHoldTimer.current);
      footerHoldTimer.current = null;
    }
  }, []);

  // === Dismiss onboarding ===
  const dismissOnboarding = useCallback(() => {
    try {
      localStorage.setItem("pootbox-onboarded-v1", "1");
    } catch { /* ignore */ }
    setOnboarded(true);
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
      {/* Onboarding screen (Task 3) */}
      {!onboarded && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(254,243,199,0.95)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            cursor: "pointer",
          }}
          onClick={dismissOnboarding}
        >
          <div
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              color: "#3D2C1E",
              marginBottom: 32,
              textAlign: "center",
            }}
          >
            Tap a circle! 👆
          </div>
          <div style={{ fontSize: "4rem", animation: "pootbox-hero-pulse 1.6s ease-in-out infinite" }}>
            🦁
          </div>
        </div>
      )}

      {/* Render circles */}
      {circlesRef.current.map((c) => (
          <CircleButton
            key={c.id}
            circle={c}
            pressed={pressedId === c.id}
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

      {/* Sparks */}
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

      {/* v43: Combo glow — subtle gold tint when comboCount >= 5 */}
      {comboCount >= 5 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at center, rgba(255, 215, 0, 0.15) 0%, transparent 70%)",
            zIndex: 3,
          }}
        />
      )}

      {/* v43: Combo burst — extra stars when reaching 5, 10, 15... */}
      {comboBurst && Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = 50 + Math.random() * 30;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        return (
          <div
            key={`combo-${comboBurst.n}-${i}`}
            aria-hidden
            style={{
              position: "fixed",
              left: comboBurst.x,
              top: comboBurst.y,
              fontSize: "1.5rem",
              pointerEvents: "none",
              zIndex: 13,
              animation: `pootbox-combo-star 0.7s ease-out forwards`,
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
            }}
          >
            {i % 2 === 0 ? "⭐" : "✨"}
          </div>
        );
      })}

      {/* v43: Confetti burst on every 10th tap. Pure delight. */}
      {confettiBurst > 0 && Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const speed = 80 + Math.random() * 60;
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed - 30; // bias upward
        const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9F1C"];
        const color = colors[i % colors.length];
        return (
          <div
            key={`confetti-${confettiBurst}-${i}`}
            aria-hidden
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              width: 10,
              height: 14,
              borderRadius: 2,
              background: color,
              pointerEvents: "none",
              zIndex: 14,
              animation: `pootbox-confetti 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
            }}
          />
        );
      })}

      {/* v43: Combo count badge — shows current combo number when >= 2 */}
      {comboCount >= 2 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: "calc(20px + env(safe-area-inset-top, 0px))",
            right: 20,
            background: "rgba(0,0,0,0.65)",
            color: comboCount >= 5 ? "#FFD700" : "white",
            padding: "8px 16px",
            borderRadius: 20,
            fontSize: "1.4rem",
            fontWeight: 800,
            fontFamily: "Fredoka, system-ui, sans-serif",
            pointerEvents: "none",
            zIndex: 11,
            transform: comboCount >= 5 ? "scale(1.15)" : "scale(1)",
            transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms",
            boxShadow: comboCount >= 5
              ? "0 0 24px rgba(255, 215, 0, 0.6)"
              : "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          ×{comboCount}
        </div>
      )}

      {/* Mic denied banner (Task 6.2) */}
      {micDenied && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            right: 16,
            background: "rgba(255,82,82,0.95)",
            color: "white",
            borderRadius: 16,
            padding: "12px 16px",
            zIndex: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            fontSize: "0.85rem",
          }}
        >
          <span style={{ flex: 1 }}>
            {micPermState === "denied"
              ? "Microphone is blocked. Click the lock icon 🔒 in the address bar → Site settings → Microphone → Allow."
              : "Microphone access denied. Tap the + button again to allow."}
          </span>
          <button
            onClick={() => {
              setMicDenied(false);
              void startRecording();
            }}
            style={{
              appearance: "none",
              border: "1px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.15)",
              color: "white",
              borderRadius: 10,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Stop button */}
      {soundPlaying && (
        <button
          data-stop-sound
          onClick={() => {
            stopAllSounds();
            setSoundPlaying(false);
          }}
          aria-label="Stop all sounds"
          style={{
            position: "fixed",
            bottom: `calc(20px + env(safe-area-inset-bottom))`,
            right: customCircles.length < MAX_CUSTOM_CIRCLES ? 96 : 20,
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

      {/* Add button (Task 5: 72px × 72px) */}
      {recPhase === "idle" && customCircles.length < MAX_CUSTOM_CIRCLES && (
        <button
          data-add-button
          onClick={() => {
            // startRecording handles unlockAudio internally AFTER
            // getUserMedia resolves. Don't call unlockAudio here — that
            // would happen before getUserMedia in some browsers and
            // consume the user gesture.
            void startRecording();
          }}
          aria-label="Add your own sound"
          style={{
            position: "fixed",
            bottom: `calc(20px + env(safe-area-inset-bottom))`,
            right: 20,
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            fontSize: "2rem",
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

      {/* Add button at max — show disabled 12/12 badge (Task 5) */}
      {recPhase === "idle" && customCircles.length >= MAX_CUSTOM_CIRCLES && (
        <div
          style={{
            position: "fixed",
            bottom: `calc(24px + env(safe-area-inset-bottom))`,
            right: 20,
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(200,190,180,0.6)",
            border: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            fontSize: "0.75rem",
            color: "#92705A",
            fontWeight: 600,
            cursor: "default",
          }}
          title="12/12 — tap one to delete"
        >
          <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>＋</span>
          <span>12/12</span>
        </div>
      )}

      {/* Delete-X badge */}
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

      {/* Recording UI — Task 6.1: bg tap cancels recording */}
      {recPhase === "recording" && (
        <div
          data-rec-overlay
          onClick={cancelRecording}
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
            {recordingMs === 0 ? "Get ready…" : "Tap the mic to stop"}
          </div>
          <div
            data-mic-button
            aria-label="Tap to stop recording"
            onClick={(e) => {
              e.stopPropagation();
              if (recordingMs > 0) stopRecording();
            }}
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
              cursor: recordingMs > 0 ? "pointer" : "default",
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
            onClick={(e) => {
              e.stopPropagation();
              if (recordingMs > 0) stopRecording();
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              cancelRecording();
            }}
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

      {/* Emoji picker — Task 6.5: click-outside dismisses */}
      {recPhase === "picking" && (
        <div
          data-emoji-picker
          onClick={cancelRecording}
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
            <div
              style={{
                color: "#3D2C1E",
                fontSize: "1.1rem",
                fontWeight: 600,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Pick an emoji
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 8,
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
                  onClick={(e) => {
                    e.stopPropagation();
                    completeRecordingWithEmoji(em);
                  }}
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
              onClick={(e) => {
                e.stopPropagation();
                if (pendingUrl) URL.revokeObjectURL(pendingUrl);
                setPendingUrl(null);
                setPendingBlob(null);
                setRecordingMs(0);
                void startRecording();
              }}
              style={{
                appearance: "none",
                border: "1px solid rgba(61,44,30,0.2)",
                background: "transparent",
                color: "#3D2C1E",
                fontSize: "0.9rem",
                padding: "8px 16px",
                borderRadius: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                marginTop: 16,
                width: "100%",
              }}
            >
              ↺ Re-record
            </button>
          </div>
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

      {/* Footer with watermark */}
      <div
        data-footer
        onPointerDown={handleFooterPointerDown}
        onPointerUp={handleFooterPointerUp}
        onPointerCancel={handleFooterPointerUp}
        style={{
          position: "fixed",
          bottom: "max(4px, env(safe-area-inset-bottom))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "auto",
          zIndex: 5,
        }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            color: "#92705A",
            opacity: 0.6,
            cursor: "default",
            userSelect: "none",
          }}
        >
          💨 PootBox v1.0.0
        </span>
      </div>

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
        @keyframes pootbox-tap-flash {
          0% { opacity: 0; }
          20% { opacity: 0.3; }
          100% { opacity: 0; }
        }
        @keyframes pootbox-combo-star {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.4) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes pootbox-confetti {
          0% { transform: translate(-50%, -50%) scale(1) rotate(0); opacity: 1; }
          100% {
            transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 200px)) scale(0.6) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// === Single circle button ===

type CircleButtonComponentProps = CircleButtonProps;

function CircleButton({
  circle,
  pressed,
  shaking,
  reducedMotion,
  showHeroPulse,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CircleButtonComponentProps) {
  const size = circle.radius * 2;
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
        transform: `scale(${pressed ? 0.88 : heroScale})`,
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
      {/* Hero glow ring */}
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
          fontSize: `${circle.radius * 1.4}px`,
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