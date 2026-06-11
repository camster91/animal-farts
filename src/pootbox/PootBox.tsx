// PootBox — v46 multi-page sound toy.
// Rewritten from scratch to consume the v46 architecture:
// multi-page tabs, random bubble spawn, library picker, and recording flow.
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import type { Page, BubbleState, Vec2, Ripple, Spark, Settings, BuiltInSound } from "./types";
import { stepPhysics } from "./physics";
import {
  BUILT_IN_SOUNDS,
  MAX_PAGES,
  DEFAULT_PAGE_EMOJI,
  FRICTION,
  WALL_BOUNCE,
  COLLISION_BOUNCE,
  DRIFT_FORCE_MAX,
  MIN_DRIFT_INTERVAL_MS,
  COLLISION_AUDIO_WINDOW_MS,
  loadSettings,
  saveSettings,
} from "./constants";
import {
  loadAllPages,
  savePage,
  addBubbleToPageDedup,
  removeBubbleFromPage,
  deletePagePure,
  generateShareCode,
  saveBlob,
  deleteBlob,
  saveRecordingEmoji,
  deleteRecordingEmoji,
  createDefaultPage,
} from "./recordings";
import { playSingle, stopAllSounds, isAnySoundPlaying } from "./audioManager";
import SettingsModal from "./SettingsModal";
import BubbleCanvas from "./components/BubbleCanvas";
import PageTabs from "./components/PageTabs";
import AddSoundMenu from "./components/AddSoundMenu";
import RecordSheet from "./components/RecordSheet";
import SoundLibrary from "./components/SoundLibrary";
import EmptyPageHint from "./components/EmptyPageHint";
import FirstRunIntro from "./components/FirstRunIntro";
import ShareSheet from "./components/ShareSheet";
import VolumeSlider from "./components/VolumeSlider";
import InstallPrompt from "./components/InstallPrompt";
import UpdatePrompt from "./components/UpdatePrompt";
import FooterBar from "./components/FooterBar";

// ─── Inline effect components ───────────────────────────────────────────────

function RippleView({ ripple }: { ripple: Ripple }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: ripple.x,
        top: ripple.y,
        width: 0,
        height: 0,
        borderRadius: "50%",
        border: `3px solid ${ripple.color}`,
        transform: "translate(-50%, -50%)",
        animation: "pootbox-ripple 0.7s ease-out forwards",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}

function SparkView({ spark }: { spark: Spark }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: spark.x,
        top: spark.y,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: spark.color,
        transform: "translate(-50%, -50%)",
        animation: "pootbox-spark 0.6s ease-out forwards",
        ["--dx" as string]: `${spark.dx * 12}px`,
        ["--dy" as string]: `${spark.dy * 12}px`,
        pointerEvents: "none",
        zIndex: 11,
        boxShadow: `0 0 6px ${spark.color}`,
      }}
    />
  );
}

const EMOJI_OPTIONS = [
  "🎤", "🎸", "🥁", "🎺", "🎹", "🎷",
  "🐶", "🐱", "🐰", "🦊", "🐻", "🐼",
  "🦁", "🐯", "🐸", "🐵", "🐔", "🦆",
  "🐮", "🐷", "🐭", "🐹", "🐨", "🦄",
  "⭐", "🌈", "🔥", "💧", "🌸", "🍕",
];

// ─── Position spawner ────────────────────────────────────────────────────────

function spawnPositionsFor(bubbles: BubbleState[], w: number, h: number): Vec2[] {
  const positions: Vec2[] = [];
  for (const b of bubbles) {
    let attempts = 0;
    while (attempts < 50) {
      const x = b.radius + Math.random() * (w - b.radius * 2);
      const y = b.radius + Math.random() * (h - b.radius * 2 - 100);
      let ok = true;
      for (const p of positions) {
        const dx = x - p.x;
        const dy = y - p.y;
        if (dx * dx + dy * dy < (b.radius + 40) ** 2) { ok = false; break; }
      }
      if (ok) { positions.push({ x, y }); break; }
      attempts++;
    }
    if (attempts >= 50) {
      positions.push({
        x: b.radius + Math.random() * (w - b.radius * 2),
        y: b.radius + Math.random() * (h - b.radius * 2 - 100),
      });
    }
  }
  return positions;
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PootBox() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Pages
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  // Home category (which bucket the default page shows)
  const [homeCategory, setHomeCategory] = useState<string>(() => {
    try { return localStorage.getItem("pootbox-home-category-v1") || "animal"; } catch { return "animal"; }
  });

  // Bubbles on active page
  const [bubbles, setBubbles] = useState<BubbleState[]>([]);
  const bubblesRef = useRef<BubbleState[]>([]);

  // Interaction
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [showPlayedFor, setShowPlayedFor] = useState<string | null>(null);

  // Recording
  const [recPhase, setRecPhase] = useState<"idle" | "recording" | "picking">("idle");
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [recordingMs, setRecordingMs] = useState(0);

  // Sheets / modals
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Audio state
  const [soundPlaying, setSoundPlaying] = useState(false);

  // Combo
  const [comboCount, setComboCount] = useState(0);
  const [comboBurst, setComboBurst] = useState<{ x: number; y: number; n: number; particles: { dx: number; dy: number }[] } | null>(null);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [confettiParticles, setConfettiParticles] = useState<{ dx: number; dy: number; color: string }[]>([]);

  // Effects
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !(localStorage.getItem("pootbox-onboarded-v1") || localStorage.getItem("pootbox-onboarded-v2"));
    } catch { return true; }
  });

  // First-run intro
  const [showFirstRun, setShowFirstRun] = useState(() => !localStorage.getItem("pootbox-firstrun-done"));

  // Volume slider
  const [showVolume, setShowVolume] = useState(false);

  // Share sheet
  const [showShare, setShowShare] = useState<"none" | "share" | "lookup">("none");

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Mic
  const [micPermState, setMicPermState] = useState<"prompt" | "denied" | "granted" | "unsupported">("prompt");
  const [micDenied, setMicDenied] = useState(false);

  // Re-render trigger
  const [, setTick] = useState(0);

  // Refs
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const lastDriftNudgeAtRef = useRef(0);
  const collisionCooldownRef = useRef<Map<string, number>>(new Map());
  const lastShakeAtRef = useRef(0);
  const shakeCountRef = useRef(0);
  const shakeWindowTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; lastX: number; lastY: number; lastT: number; velocity: Vec2 } | null>(null);
  const blankHoldTimer = useRef<number | null>(null);
  const blankHoldStartPos = useRef<Vec2 | null>(null);
  const rippleIdRef = useRef(0);
  const sparkIdRef = useRef(0);
  const lifetimeTapsRef = useRef(0);
  const comboCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const comboResetTimerRef = useRef<number | null>(null);
  const lastCirclePlayRef = useRef<Map<string, number>>(new Map());
  const audioUnlockedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingStartRef = useRef(0);
  const saveDebounceRef = useRef<number | null>(null);
  const comboBurstTimeoutRef = useRef<number | null>(null);

  const triggerComboBurst = useCallback((x: number, y: number, n: number) => {
    const particles = Array.from({ length: 8 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 30;
      return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
    });
    setComboBurst({ x, y, n, particles });
    if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
    comboBurstTimeoutRef.current = window.setTimeout(() => setComboBurst(null), 700);
  }, []);

  const triggerConfetti = useCallback(() => {
    const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9F1C"];
    const particles = Array.from({ length: 24 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 60;
      return { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 30, color: colors[Math.floor(Math.random() * colors.length)] };
    });
    setConfettiParticles(particles);
    setConfettiBurst(c => c + 1);
  }, []);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  // ── Measure canvas ─────────────────────────────────────────────────────

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

  // ── Load pages on mount ────────────────────────────────────────────────

  useEffect(() => {
    void loadAllPages().then((loaded) => {
      if (loaded.length === 0) {
        const defaultPage = createDefaultPage(homeCategory);
        setPages([defaultPage]);
        setActivePageId("page:default");
        void savePage(defaultPage);
      } else {
        setPages(loaded);
        setActivePageId(loaded[0].id);
      }
    });
  }, []);

  // ── Persist homeCategory + update default page when it changes ─────────

  // Persist to localStorage + sync default page bubbles when homeCategory changes.
  // The setHomeCategory handler below does the side effects directly (no effect),
  // which keeps the setState-in-effect lint happy and avoids a redundant render.
  useEffect(() => {
    try { localStorage.setItem("pootbox-home-category-v1", homeCategory); } catch { /* best-effort */ }
  }, [homeCategory]);

  // ── Sync bubblesRef when active page changes ────────────────────────────

  useEffect(() => {
    if (!activePageId || size.w === 0) return;
    const page = pages.find(p => p.id === activePageId);
    if (!page) return;

    const needsSpawn = page.bubbles.every(b => b.pos.x === 0 && b.pos.y === 0);
    const positions = needsSpawn
      ? spawnPositionsFor(page.bubbles, size.w, size.h)
      : page.bubbles.map(b => b.pos);

    const synced = page.bubbles.map((b, i) => ({
      ...b,
      pos: positions[i] ?? b.pos,
      vel: { x: 0, y: 0 },
    }));

    bubblesRef.current = synced;
  }, [activePageId, pages, size.w, size.h]);

  // ── Debounced save pages ───────────────────────────────────────────────

  const savePagesDebounced = useCallback((pagesToSave: Page[]) => {
    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = window.setTimeout(() => {
      void savePage(pagesToSave.find(p => p.id === activePageId) ?? pagesToSave[0]);
    }, 500);
  }, [activePageId]);

  // ── Mic permission pre-check ──────────────────────────────────────────

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then(p => {
      if (cancelled) return;
      const initialState = p.state as typeof micPermState;
      queueMicrotask(() => {
        if (cancelled) return;
        setMicPermState(initialState);
        if (initialState === "denied") setMicDenied(true);
      });
      p.addEventListener("change", () => {
        if (cancelled) return;
        const ns = p.state as typeof micPermState;
        setMicPermState(ns);
        setMicDenied(ns === "denied");
      });
    }).catch(() => { /* Firefox doesn't support query */ });
    return () => { cancelled = true; };
  }, []);

  // ── Shake detection ───────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (mag > 22) {
        const now = Date.now();
        if (now - lastShakeAtRef.current > 1000) {
          shakeCountRef.current = 0;
          lastShakeAtRef.current = now;
        }
        shakeCountRef.current++;
        lastShakeAtRef.current = now;
        if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
        shakeWindowTimerRef.current = window.setTimeout(() => { shakeCountRef.current = 0; }, 2000);
        if (shakeCountRef.current >= 3) {
          setShowSettings(true);
          shakeCountRef.current = 0;
          // Nudge all bubbles
          for (const b of bubblesRef.current) {
            b.vel.x += (Math.random() - 0.5) * 5;
            b.vel.y += (Math.random() - 0.5) * 5;
            b.lastTouchedAt = now;
          }
        }
      }
    };
    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, []);

  // ── Sound playing poll ─────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(() => {
      setSoundPlaying(isAnySoundPlaying());
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // ── Physics loop ───────────────────────────────────────────────────────

  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;
      const dt = lastFrameRef.current === 0 ? 16.67 : now - lastFrameRef.current;
      lastFrameRef.current = now;
      const clampedDt = Math.min(dt, 50);

      const collisions = stepPhysics(
        bubblesRef.current,
        {
          friction: FRICTION,
          wallBounce: WALL_BOUNCE,
          collisionBounce: COLLISION_BOUNCE,
          driftIntervalMs: MIN_DRIFT_INTERVAL_MS,
          driftForceMax: DRIFT_FORCE_MAX,
          viewportWidth: size.w,
          viewportHeight: size.h,
          collisionAudioWindowMs: COLLISION_AUDIO_WINDOW_MS,
        },
        now,
        clampedDt,
        lastDriftNudgeAtRef,
        collisionCooldownRef
      );

      for (const ev of collisions) {
        if (ev.shouldPlaySound) {
          const bA = bubblesRef.current.find(b => b.id === (ev.a as unknown as BubbleState).id);
          const bB = bubblesRef.current.find(b => b.id === (ev.b as unknown as BubbleState).id);
          if (bA && bB) playSingle(bA.lastTouchedAt >= bB.lastTouchedAt ? bA.sound : bB.sound, settingsRef.current.volume);
        }
        // Spawn sparks at collision midpoint
        const sx = (ev.a.pos.x + ev.b.pos.x) / 2;
        const sy = (ev.a.pos.y + ev.b.pos.y) / 2;
        const newSparks: Spark[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 2 + Math.random() * 3;
          newSparks.push({
            id: ++sparkIdRef.current,
            x: sx, y: sy,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            color: "rgba(255,255,255,0.6)",
            life: 600,
          });
        }
        setSparks(prev => [...prev, ...newSparks]);
        setTimeout(() => setSparks(prev => prev.filter(s => !newSparks.find(ns => ns.id === s.id))), 600);
      }

      // Sync to state (bubble positions rendered via BubbleCanvas)
      setBubbles([...bubblesRef.current]);
      setTick(t => (t + 1) % 1000000);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size.w, size.h]);

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
      if (comboResetTimerRef.current) window.clearTimeout(comboResetTimerRef.current);
      if (comboBurstTimeoutRef.current) window.clearTimeout(comboBurstTimeoutRef.current);
      if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      if (shakeWindowTimerRef.current) window.clearTimeout(shakeWindowTimerRef.current);
    };
  }, []);

  // ── Audio unlock ───────────────────────────────────────────────────────

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      const silent = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      silent.volume = 0;
      void silent.play().catch(() => { audioUnlockedRef.current = false; });
    } catch { audioUnlockedRef.current = false; }
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current) return;
    if (micPermState === "denied") { setMicDenied(true); return; }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicDenied(true);
      setRecPhase("idle");
      return;
    }
    mediaStreamRef.current = stream;
    setMicDenied(false);
    unlockAudio();
    const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaChunksRef.current = [];
    rec.ondataavailable = e => { if (e.data?.size > 0) mediaChunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(mediaChunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (mediaChunksRef.current.length === 0 || blob.size === 0) { setRecPhase("idle"); return; }
      const url = URL.createObjectURL(blob);
      setPendingBlob(blob);
      setPendingUrl(url);
      setRecPhase("picking");
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
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
      if (ms >= 6000 && mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      }
    }, 50);
  }, [micPermState, unlockAudio]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) { window.clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingBlob(null);
    setPendingUrl(null);
    setRecordingMs(0);
    setRecPhase("idle");
  }, [pendingUrl]);

  // ── Add built-in sound to page ────────────────────────────────────────

  const onPickBuiltIn = useCallback(async (sound: BuiltInSound) => {
    if (!activePageId) return;
    const bubble: BubbleState = {
      id: `b:built-in:${sound.key}:${Date.now()}`,
      type: "built-in",
      emoji: sound.emoji,
      builtinKey: sound.key,
      sound: sound.file,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 36,
      mass: 1,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    };
    const { pages: updatedPages, added } = addBubbleToPageDedup(pages, activePageId, bubble);
    if (!added) {
      showToast("Already on this page!");
      return;
    }
    setPages(updatedPages);
    setShowLibrary(false);
  }, [activePageId, pages, showToast]);

  // ── Complete recorded sound ───────────────────────────────────────────

  const onPickRecordedEmoji = useCallback(async (emoji: string) => {
    if (!pendingBlob || !pendingUrl || !activePageId) return;
    const id = `b:custom:${Date.now()}`;
    const bubble: BubbleState = {
      id,
      type: "custom",
      emoji,
      blobUrl: pendingUrl,
      sound: pendingUrl,
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      radius: 36,
      mass: 1,
      lastTouchedAt: -1,
      lastReleasedAt: -1,
    };
    await saveBlob(id, pendingBlob);
    saveRecordingEmoji(id, emoji);
    const { pages: updatedPages, added } = addBubbleToPageDedup(pages, activePageId, bubble);
    if (!added) {
      showToast("Already on this page!");
    } else {
      setPages(updatedPages);
    }
    setPendingBlob(null);
    setPendingUrl(null);
    setRecPhase("idle");
  }, [pendingBlob, pendingUrl, activePageId, pages, showToast]);

  // ── Remove bubble ─────────────────────────────────────────────────────

  const onRemoveBubble = useCallback(async (id: string) => {
    if (!activePageId) return;
    if (id.startsWith("b:custom:")) {
      const b = bubbles.find(x => x.id === id);
      if (b?.blobUrl) URL.revokeObjectURL(b.blobUrl);
      await deleteBlob(id);
      deleteRecordingEmoji(id);
    }
    const updated = await removeBubbleFromPage(activePageId, id);
    setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, [activePageId, bubbles]);

  // ── Add page ──────────────────────────────────────────────────────────

  const onAddPage = useCallback(() => {
    if (pages.length >= MAX_PAGES) return;
    // When adding the first new page (only the default exists), seed it with homeCategory bubbles
    const seedBubbles = pages.length === 1
      ? createDefaultPage(homeCategory).bubbles
      : [];
    const newPage: Page = {
      id: `page:${Date.now()}`,
      name: "New Page",
      emoji: DEFAULT_PAGE_EMOJI,
      bubbles: seedBubbles,
      createdAt: Date.now(),
    };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
    void savePage(newPage);
  }, [pages.length, homeCategory]);

  // ── Select page ───────────────────────────────────────────────────────

  const onSelectPage = useCallback((pageId: string) => {
    setActivePageId(pageId);
  }, []);

  // ── Rename page ───────────────────────────────────────────────────────

  const onRenamePage = useCallback((pageId: string, newName: string, newEmoji: string) => {
    setPages(prev => {
      const updated = prev.map(p =>
        p.id === pageId ? { ...p, name: newName, emoji: newEmoji } : p
      );
      const changed = updated.find(p => p.id === pageId);
      if (changed) void savePage(changed);
      return updated;
    });
  }, []);

  // ── Delete page ───────────────────────────────────────────────────────

  const onDeletePage = useCallback(async (pageId: string) => {
    const { pages: updatedPages, removedBlobs } = deletePagePure(pages, pageId);
    if (updatedPages.length === pages.length) return; // nothing changed

    // Delete blobs for custom recordings on this page
    for (const blobId of removedBlobs) {
      await deleteBlob(blobId);
      deleteRecordingEmoji(blobId);
    }

    setPages(updatedPages);

    // Switch to another page if the deleted one was active
    if (activePageId === pageId) {
      const remaining = updatedPages.filter(p => p.id !== pageId);
      setActivePageId(remaining[0]?.id ?? null);
    }

    // Persist all remaining pages
    for (const p of updatedPages) {
      void savePage(p);
    }
  }, [pages, activePageId]);

  // ── Play sound from bubble ────────────────────────────────────────────

  const playFromBubble = useCallback((b: BubbleState, volume: number) => {
    const now = performance.now();
    const last = lastCirclePlayRef.current.get(b.id) ?? 0;
    if (now - last < 250) return;
    lastCirclePlayRef.current.set(b.id, now);
    playSingle(b.sound, volume);
  }, []);

  // ── Spawn ripple ──────────────────────────────────────────────────────

  const spawnRipple = useCallback((x: number, y: number, color = "rgba(255,255,255,0.5)") => {
    const id = ++rippleIdRef.current;
    setRipples(prev => [...prev, { id, x, y, color }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);
  }, []);

  // ── Tap handler ───────────────────────────────────────────────────────

  const handleBubbleTap = useCallback((id: string, clientX: number, clientY: number) => {
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    const now = performance.now();
    b.lastTouchedAt = now;

    playFromBubble(b, settingsRef.current.volume);
    spawnRipple(clientX, clientY);

    // Show played indicator
    setShowPlayedFor(id);
    setTimeout(() => setShowPlayedFor(null), 800);

    // Combo
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
    if (comboResetTimerRef.current) window.clearTimeout(comboResetTimerRef.current);
    comboResetTimerRef.current = window.setTimeout(() => {
      setComboCount(0);
      comboCountRef.current = 0;
    }, 800);

    // Combo burst at milestones
    if (newCombo % 5 === 0) {
      triggerComboBurst(clientX, clientY, newCombo);
    }

    // Lifetime taps → confetti every 10
    const newLifetime = lifetimeTapsRef.current + 1;
    lifetimeTapsRef.current = newLifetime;
    if (newLifetime % 10 === 0) triggerConfetti();

    // Dismiss onboarding on first tap
    if (showOnboarding) {
      setShowOnboarding(false);
      try { localStorage.setItem("pootbox-onboarded-v2", "1"); } catch { /* ignore */ }
    }
  }, [playFromBubble, spawnRipple, showOnboarding, triggerComboBurst, triggerConfetti]);

  // ── Bubble pointer handlers ───────────────────────────────────────────

  const onBubblePointerDown = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    if (target.setPointerCapture && e.pointerId !== undefined) {
      try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    setPressedId(id);
    unlockAudio();
    handleBubbleTap(id, e.clientX, e.clientY);

    const b = bubblesRef.current.find(x => x.id === id);
    if (b) { b.vel.x = 0; b.vel.y = 0; }

    dragRef.current = {
      id,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: { x: 0, y: 0 },
    };
  }, [handleBubbleTap, unlockAudio]);

  const onBubblePointerMove = useCallback((id: string, e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const b = bubblesRef.current.find(x => x.id === id);
    if (!b) return;
    const now = performance.now();
    b.lastTouchedAt = now;
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
    b.pos.x = e.clientX - rect.left;
    b.pos.y = e.clientY - rect.top;
  }, []);

  const onBubblePointerUp = useCallback((id: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPressedId(null);
    const drag = dragRef.current;
    if (drag && drag.id === id) {
      const b = bubblesRef.current.find(x => x.id === id);
      if (b) {
        // Short tap = show delete for custom
        const totalDist = Math.sqrt((e.clientX - drag.lastX) ** 2 + (e.clientY - drag.lastY) ** 2);
        if (totalDist < 8 && id.startsWith("b:custom:")) {
          onRemoveBubble(id);
        }
        b.vel.x = drag.velocity.x * 16.67;
        b.vel.y = drag.velocity.y * 16.67;
        b.lastTouchedAt = performance.now();
        b.lastReleasedAt = performance.now();
        // Persist position
        setPages(prev => {
          const updated = prev.map(p => {
            if (p.id !== activePageId) return p;
            return {
              ...p,
              bubbles: p.bubbles.map(bb => bb.id === id ? { ...bb, pos: { ...b.pos } } : bb),
            };
          });
          savePagesDebounced(updated);
          return updated;
        });
      }
      dragRef.current = null;
    }
  }, [activePageId, onRemoveBubble, savePagesDebounced]);

  const onBubblePointerCancel = useCallback((id: string) => {
    setPressedId(null);
    if (dragRef.current?.id === id) {
      const b = bubblesRef.current.find(x => x.id === id);
      if (b) b.lastTouchedAt = performance.now();
      dragRef.current = null;
    }
  }, []);

  // ── Blank area handlers ───────────────────────────────────────────────

  const onBlankPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    unlockAudio();
    blankHoldStartPos.current = { x: e.clientX, y: e.clientY };
    if (blankHoldTimer.current) window.clearTimeout(blankHoldTimer.current);
    blankHoldTimer.current = window.setTimeout(() => {
      setShowSettings(true);
      blankHoldTimer.current = null;
    }, 5000);
  }, [unlockAudio]);

  const onBlankPointerMove = useCallback((e: React.PointerEvent) => {
    if (!blankHoldStartPos.current) return;
    const dx = Math.abs(e.clientX - blankHoldStartPos.current.x);
    const dy = Math.abs(e.clientY - blankHoldStartPos.current.y);
    if (dx > 25 || dy > 25) {
      if (blankHoldTimer.current) { window.clearTimeout(blankHoldTimer.current); blankHoldTimer.current = null; }
      blankHoldStartPos.current = null;
    }
  }, []);

  const onBlankPointerUp = useCallback(() => {
    if (blankHoldTimer.current) { window.clearTimeout(blankHoldTimer.current); blankHoldTimer.current = null; }
    blankHoldStartPos.current = null;
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────

  const alreadyAddedKeys = new Set(bubbles.map(b => b.builtinKey).filter((k): k is string => !!k));

  // ── Render ────────────────────────────────────────────────────────────

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
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
      onPointerDown={onBlankPointerDown}
      onPointerMove={onBlankPointerMove}
      onPointerUp={onBlankPointerUp}
      onPointerCancel={onBlankPointerUp}
    >
      <FirstRunIntro
        show={showFirstRun}
        onDone={() => {
          localStorage.setItem("pootbox-firstrun-done", "1");
          setShowFirstRun(false);
        }}
      />

      {/* Bubble canvas */}
      <BubbleCanvas
        bubbles={bubbles}
        pressedId={pressedId}
        reducedMotion={settings.reducedMotion}
        showPlayedFor={showPlayedFor}
        onBubblePointerDown={onBubblePointerDown}
        onBubblePointerMove={onBubblePointerMove}
        onBubblePointerUp={onBubblePointerUp}
        onBubblePointerCancel={onBubblePointerCancel}
      />

      {/* Empty page hint */}
      {activePageId && pages.find(p => p.id === activePageId)?.bubbles.length === 0 && (
        <EmptyPageHint show={true} />
      )}

      {/* Page tabs */}
      <PageTabs
        pages={pages}
        activePageId={activePageId ?? ""}
        onSelectPage={onSelectPage}
        onAddPage={onAddPage}
        onRenamePage={onRenamePage}
        onDeletePage={onDeletePage}
        canDelete={pages.length > 1}
      />

      {/* Home category chips — only on the default page */}
      {activePageId === "page:default" && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 0,
            right: 0,
            zIndex: 150,
            background: "rgba(254, 243, 199, 0.95)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "8px 16px",
            overflowX: "auto",
            whiteSpace: "nowrap",
            maxWidth: "100vw",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              gap: 8,
            }}
          >
            {[
              { label: "Animals", value: "animal" },
              { label: "Farts", value: "fart" },
              { label: "Silly", value: "silly" },
              { label: "Instruments", value: "instrument" },
            ].map(({ label, value }) => {
              const isActive = homeCategory === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    setHomeCategory(value);
                    // Sync default page bubbles immediately (no effect needed)
                    setPages(prev => {
                      const idx = prev.findIndex(p => p.id === "page:default");
                      if (idx === -1) return prev;
                      const updated = createDefaultPage(value);
                      const next = [...prev];
                      next[idx] = { ...updated, id: "page:default", createdAt: prev[idx].createdAt };
                      void savePage(next[idx]);
                      return next;
                    });
                  }}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    borderRadius: 16,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    fontFamily: "Fredoka, system-ui, sans-serif",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    border: isActive ? "none" : "1px solid #E5E0D5",
                    background: isActive ? "#F59E0B" : "transparent",
                    color: isActive ? "#FFFFFF" : "#3D2C1E",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Volume icon */}
      <button
        aria-label="Volume"
        onClick={() => {
          if (settings.volume > 0) {
            // Mute: set volume to 0
            const updated = { ...settings, volume: 0 };
            setSettings(updated);
            saveSettings(updated);
          } else {
            // Unmute: open slider to choose level
            setShowVolume(true);
          }
        }}
        style={{
          position: "fixed",
          top: 64,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(61,44,30,0.85)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          zIndex: 200,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          padding: 0,
        }}
      >
        {settings.volume > 0 ? "🔊" : "🔇"}
      </button>

      {/* Share button */}
      <button
        aria-label="Share page"
        onClick={() => setShowShare("share")}
        style={{
          position: "fixed",
          top: 116,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(61,44,30,0.85)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          zIndex: 200,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          padding: 0,
        }}
      >
        🔗
      </button>

      {/* Volume slider popover */}
      <VolumeSlider
        show={showVolume}
        volume={settings.volume}
        onChange={(v) => {
          const updated = { ...settings, volume: v };
          setSettings(updated);
          saveSettings(updated);
          setShowVolume(false);
        }}
        position={{ top: 64, left: window.innerWidth - 320 }}
      />

      {/* Share sheet */}
      {(showShare === "share" || showShare === "lookup") && (
        <ShareSheet
          mode={showShare === "share" ? "share" : "lookup"}
          pageName={pages.find(p => p.id === activePageId)?.name ?? "Untitled"}
          onClose={() => setShowShare("none")}
          onGenerateCode={async () => generateShareCode()}
          onCopyCode={(c) => { try { void navigator.clipboard?.writeText(c); } catch { /* ignore */ } }}
          onLookupCode={async (code) => {
            try {
              const r = await fetch(`/api/share/${code}`);
              if (!r.ok) return null;
              return await r.json();
            } catch { return null; }
          }}
          onAddAsPage={(data) => {
            const newPage: Page = {
              id: `page:share-${data.code}-${Date.now()}`,
              name: data.name || `Shared ${data.code}`,
              emoji: data.emoji || "🔗",
              bubbles: [{
                id: `b:shared:${data.code}:${Date.now()}`,
                type: "custom",
                emoji: data.emoji || "🔗",
                blobUrl: data.audioUrl,
                pos: { x: 0, y: 0 },
                vel: { x: 0, y: 0 },
                radius: 36,
                mass: 1,
                sound: data.audioUrl,
                lastTouchedAt: -1,
                lastReleasedAt: -1,
              }],
              createdAt: Date.now(),
            };
            setPages((prev) => [...prev, newPage]);
            setActivePageId(newPage.id);
            void savePage(newPage);
            setShowShare("none");
          }}
        />
      )}

      {/* Add sound menu */}
      <AddSoundMenu
        onRecord={() => void startRecording()}
        onPickFromLibrary={() => setShowLibrary(true)}
        onAddNewPage={onAddPage}
        onOpenSettings={() => setShowSettings(true)}
        pagesCount={pages.length}
        maxPages={MAX_PAGES}
      />

      {/* Ripples */}
      {ripples.map(r => <RippleView key={r.id} ripple={r} />)}

      {/* Sparks */}
      {sparks.map(s => <SparkView key={s.id} spark={s} />)}

      {/* Combo glow */}
      {comboCount >= 5 && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at center, rgba(255,215,0,0.15) 0%, transparent 70%)",
            zIndex: 3,
          }}
        />
      )}

      {/* Combo burst stars */}
      {comboBurst && comboBurst.particles.map((p, i) => (
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
            animation: "pootbox-combo-star 0.7s ease-out forwards",
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
          }}
        >
          {i % 2 === 0 ? "⭐" : "✨"}
        </div>
      ))}

      {/* Confetti */}
      {confettiBurst > 0 && confettiParticles.map((p, i) => (
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
            background: p.color,
            pointerEvents: "none",
            zIndex: 14,
            animation: "pootbox-confetti 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
          }}
        />
      ))}

      {/* Combo badge */}
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
            boxShadow: comboCount >= 5 ? "0 0 24px rgba(255,215,0,0.6)" : "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          ×{comboCount}
        </div>
      )}

      {/* Stop button */}
      {soundPlaying && (
        <button
          onClick={() => { stopAllSounds(); setSoundPlaying(false); }}
          aria-label="Stop all sounds"
          style={{
            position: "fixed",
            bottom: "calc(20px + env(safe-area-inset-bottom))",
            right: 20,
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
            animation: "pootbox-pulse-stop 1s ease-in-out infinite",
          }}
        >
          ⏹
        </button>
      )}

      {/* Mic denied banner */}
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
              ? "Microphone blocked. Tap the lock 🔒 in the address bar → Site settings → Allow."
              : "Microphone access denied. Tap + again to allow."}
          </span>
          <button
            onClick={() => { setMicDenied(false); void startRecording(); }}
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

      {/* Recording sheet */}
      {recPhase === "recording" || recPhase === "picking" ? (
        <RecordSheet
          recPhase={recPhase}
          recordingMs={recordingMs}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onPickEmoji={onPickRecordedEmoji}
          onRedo={() => {
            if (pendingUrl) URL.revokeObjectURL(pendingUrl);
            setPendingUrl(null);
            setPendingBlob(null);
            setRecordingMs(0);
            void startRecording();
          }}
          emojiOptions={EMOJI_OPTIONS}
        />
      ) : null}

      {/* Sound library */}
      {showLibrary && (
        <SoundLibrary
          builtInSounds={BUILT_IN_SOUNDS}
          alreadyAddedKeys={alreadyAddedKeys}
          onPick={onPickBuiltIn}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={s => { setSettings(s); saveSettings(s); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* OnboardingHint removed — first-run intro is sufficient */}

      

      
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "10px 20px",
          borderRadius: 24,
          zIndex: 1000,
          fontFamily: "Fredoka, system-ui, sans-serif",
          fontSize: "0.95rem",
        }}>
          {toast}
        </div>
      )}

      <FooterBar
        installBanner={<InstallPrompt />}
        updateBanner={<UpdatePrompt />}
      />

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
