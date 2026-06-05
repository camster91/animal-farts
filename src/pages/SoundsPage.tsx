// v25v: scenes interface. Full-screen illustrated scene with
// 6-10 tappable things. The kid swipes left/right to change
// scenes. No menus, no filter chips, no library. The scene
// IS the app.

import { useState, useRef, useCallback, useEffect } from "react";
import { SCENES, type Scene, type SceneThing } from "../scenes";
import {
  playSound,
  stopAllSounds,
  setPitchRate,
  setEchoAmount,
  setLengthScale,
  startRecording,
  stopRecording,
  MAX_RECORDING_SEC,
} from "../audio/fartEngine";
import { useFx } from "../fxContext";
import { usePoof } from "../poofContext";

const TAP_SIZE_DEFAULT = 18; // % of scene width

export default function SoundsPage() {
  const onPoof = usePoof();
  const { pitch, setPitch, length, setLength, echo, setEcho, resetFx } = useFx();

  // Which scene is shown
  const [sceneIdx, setSceneIdx] = useState(0);
  const scene: Scene = SCENES[sceneIdx];

  // Active thing (brief scale animation)
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTimer = useRef<number | null>(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordInterval = useRef<number | null>(null);

  // Parental gear — hidden by default, revealed by long-pressing top-left
  const [showGear, setShowGear] = useState(false);
  const [showFx, setShowFx] = useState(false);
  const [showKidsMenu, setShowKidsMenu] = useState(false);
  const [anySoundPlaying, setAnySoundPlaying] = useState(false);
  const gearLongPressTimer = useRef<number | null>(null);
  const lastTapTime = useRef(0);

  // Swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const sceneContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync FX to engine
  useEffect(() => { setPitchRate(pitch); }, [pitch]);
  useEffect(() => { setLengthScale(length); }, [length]);
  useEffect(() => { setEchoAmount(echo ? 1 : 0); }, [echo]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      setRecordSeconds(0);
      recordInterval.current = window.setInterval(() => {
        setRecordSeconds((s) => Math.min(MAX_RECORDING_SEC, s + 0.1));
      }, 100);
    } else if (recordInterval.current) {
      window.clearInterval(recordInterval.current);
      recordInterval.current = null;
    }
    return () => { if (recordInterval.current) window.clearInterval(recordInterval.current); };
  }, [recording]);

  // Stop button polling
  useEffect(() => {
    const id = window.setInterval(() => {
      let n = 0;
      for (const a of document.querySelectorAll("audio")) {
        if (!a.paused) n++;
      }
      setAnySoundPlaying(n > 0);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  // Tap a thing → play a random sound from its sounds[]
  const onTapThing = useCallback(
    (thing: SceneThing, e: React.MouseEvent | React.TouchEvent) => {
      const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
      void playSound(sound);
      setActiveId(thing.id);
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
      activeTimer.current = window.setTimeout(() => {
        setActiveId((cur) => (cur === thing.id ? null : cur));
      }, 350);
      const point = "touches" in e
        ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
        : (e as any);
      onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, thing.emoji);
    },
    [onPoof]
  );

  // Swipe handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) setSceneIdx((i) => Math.min(SCENES.length - 1, i + 1));
    else setSceneIdx((i) => Math.max(0, i - 1));
  }, []);

  // Record button
  const onToggleRecord = useCallback(async () => {
    if (recording) {
      const result = await stopRecording();
      setRecording(false);
      if (result && result.duration > 0.2) {
        const url = URL.createObjectURL(result.blob);
        const pending = JSON.parse(localStorage.getItem("emoji-farts-pending") || "[]");
        pending.push({
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url, duration: result.duration, createdAt: Date.now(),
        });
        localStorage.setItem("emoji-farts-pending", JSON.stringify(pending));
        window.dispatchEvent(new CustomEvent("emoji-farts:pending-changed"));
        onPoof(window.innerWidth / 2, window.innerHeight / 2, "🎤");
      }
    } else {
      try {
        await startRecording();
        setRecording(true);
        onPoof(window.innerWidth / 2, window.innerHeight / 2, "🎤");
      } catch {
        alert("Need microphone permission to record.");
      }
    }
  }, [recording, onPoof]);

  // Parental gear — long-press in top-left to reveal
  const onGearTouchStart = useCallback(() => {
    gearLongPressTimer.current = window.setTimeout(() => setShowGear(true), 1200);
  }, []);
  const onGearTouchEnd = useCallback(() => {
    if (gearLongPressTimer.current) {
      window.clearTimeout(gearLongPressTimer.current);
      gearLongPressTimer.current = null;
    }
  }, []);

  // Show Kids menu on a single tap of the top-left (after long-press has been used once)
  const onTopLeftTap = useCallback(() => {
    if (showGear) return;
    // Triple-tap in same spot to reveal
    const now = Date.now();
    if (now - lastTapTime.current < 400) {
      setShowGear(true);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, [showGear]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Scene container — full bleed */}
      <div
        ref={sceneContainerRef}
        className={`absolute inset-0 bg-gradient-to-b ${scene.bg} transition-colors duration-700`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onTopLeftTap}
      >
        {/* Scene name overlay — fades in for 1.5s on scene change */}
        <div
          key={scene.id + "-name"}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/30 backdrop-blur-sm text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg animate-[fadein_0.4s_ease-out,fadeout_0.6s_ease-in_1s_forwards] pointer-events-none z-10"
        >
          {scene.name}
        </div>

        {/* Tappable things */}
        {scene.things.map((thing) => (
          <button
            key={thing.id}
            onClick={(e) => {
              e.stopPropagation();
              onTapThing(thing, e);
            }}
            onTouchStart={(e) => { e.stopPropagation(); onGearTouchEnd(); }}
            style={{
              position: "absolute",
              left: `${thing.x}%`,
              top: `${thing.y}%`,
              transform: "translate(-50%, -50%)",
              width: `${thing.size ?? TAP_SIZE_DEFAULT}%`,
              height: `${thing.size ?? TAP_SIZE_DEFAULT}%`,
              touchAction: "manipulation",
            }}
            className="flex items-center justify-center active:scale-90 transition-transform select-none"
            aria-label={thing.name}
          >
            <span className={`text-5xl sm:text-6xl transition-transform drop-shadow-lg ${activeId === thing.id ? "scale-125" : "scale-100"}`}>
              {thing.emoji}
            </span>
          </button>
        ))}

        {/* Scene indicator dots — bottom center */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={(e) => { e.stopPropagation(); setSceneIdx(i); }}
              aria-label={`Go to ${s.name}`}
              className={`w-3 h-3 rounded-full transition-all ${
                i === sceneIdx ? "bg-white scale-125" : "bg-white/40"
              }`}
            />
          ))}
        </div>

        {/* Arrow hints — left/right edges for non-touch users */}
        {sceneIdx > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setSceneIdx((i) => i - 1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm text-white text-2xl flex items-center justify-center z-10 active:scale-90"
            aria-label="Previous scene"
          >‹</button>
        )}
        {sceneIdx < SCENES.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); setSceneIdx((i) => i + 1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm text-white text-2xl flex items-center justify-center z-10 active:scale-90"
            aria-label="Next scene"
          >›</button>
        )}
      </div>

      {/* Hidden parental gear — top-left corner is the trigger zone.
          Long-press (1.2s) reveals the gear. After that, a single tap
          on the gear opens the parents overlay. */}
      <div
        className="absolute top-0 left-0 w-20 h-20 z-20"
        onTouchStart={onGearTouchStart}
        onTouchEnd={onGearTouchEnd}
        onMouseDown={onGearTouchStart}
        onMouseUp={onGearTouchEnd}
        onMouseLeave={onGearTouchEnd}
      />
      {showGear && (
        <button
          onClick={() => setShowKidsMenu(true)}
          className="absolute top-3 left-3 w-12 h-12 rounded-full bg-white/40 backdrop-blur-md text-2xl flex items-center justify-center shadow-lg z-30 active:scale-90"
          aria-label="Parental controls"
        >
          👪
        </button>
      )}

      {/* Stop button (when sound playing) — bottom-right corner */}
      {anySoundPlaying && !recording && (
        <button
          onClick={() => {
            stopAllSounds();
            onPoof(window.innerWidth / 2, window.innerHeight / 2, "⏹");
            setAnySoundPlaying(false);
          }}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-red-500 text-white text-2xl shadow-lg z-30 active:scale-90 animate-pulse"
          aria-label="Stop all sounds"
        >
          ⏹
        </button>
      )}

      {/* Record button — bottom-left corner, semi-transparent */}
      <button
        onClick={onToggleRecord}
        className={`absolute bottom-4 left-4 w-12 h-12 rounded-full text-2xl shadow-lg z-30 active:scale-90 ${
          recording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-white/60 backdrop-blur-md text-amber-900"
        }`}
        aria-label={recording ? "Stop recording" : "Record"}
      >
        {recording ? `⏹${recordSeconds.toFixed(0)}` : "🎤"}
      </button>

      {/* Parents overlay (kid menu + FX) */}
      {showKidsMenu && (
        <div
          className="absolute inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowKidsMenu(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-amber-900">👪 Parents</h2>
              <button
                onClick={() => setShowKidsMenu(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold active:scale-95"
              >✕</button>
            </div>
            <button
              onClick={() => { setShowFx(!showFx); }}
              className="w-full mb-2 py-3 rounded-xl font-bold bg-amber-100 text-amber-900 active:scale-95"
            >
              🎚️ Make it funny (FX)
            </button>
            <button
              onClick={() => {
                stopAllSounds();
                const t = scene.things[Math.floor(Math.random() * scene.things.length)];
                onTapThing(t, { touches: [{ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }], changedTouches: [{ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }] } as any);
              }}
              className="w-full py-3 rounded-xl font-bold bg-purple-100 text-purple-900 active:scale-95"
            >
              🎲 Random sound
            </button>

            {showFx && (
              <div className="mt-4 p-3 bg-amber-50 rounded-2xl">
                <SliderRow emoji={pitch < 0.8 ? "🐢" : pitch > 1.2 ? "🐿️" : "😐"} label="Pitch" value={pitch} min={0.5} max={2.0} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setPitch} onReset={() => setPitch(1.0)} />
                <SliderRow emoji={length < 0.8 ? "⚡" : length > 1.2 ? "🐌" : "⏱️"} label="Length" value={length} min={0.5} max={2.0} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setLength} onReset={() => setLength(1.0)} />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEcho(!echo)}
                    className={`flex-1 font-bold text-sm py-3 rounded-xl border-2 active:scale-95 ${
                      echo ? "bg-cyan-100 text-cyan-900 border-cyan-400" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    🚿 Bathroom Echo {echo ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={resetFx}
                    className="px-4 font-bold text-sm py-3 rounded-xl border-2 bg-white text-slate-600 border-slate-200 active:scale-95"
                    title="Reset all"
                  >↺</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SliderRow({
  emoji, label, value, min, max, step, format, onChange, onReset,
}: {
  emoji: string; label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void; onReset: () => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-slate-700">
          <span className="text-base mr-1">{emoji}</span> {label}
        </span>
        <button
          onClick={onReset}
          className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md active:scale-95"
        >
          {format(value)} ↺
        </button>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
        style={{ touchAction: "manipulation" }}
      />
    </div>
  );
}
