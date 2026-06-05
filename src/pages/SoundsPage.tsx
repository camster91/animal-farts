import { useState, useEffect, useCallback, useRef } from "react";
import {
  playRandomFart,
  stopAllSounds,
  setPitchRate,
  setEchoAmount,
  setLengthScale,
  startRecording,
  stopRecording,
  MAX_RECORDING_SEC,
} from "../audio/fartEngine";
import { ANIMALS, type Animal } from "../animals";
import { useFx } from "../fxContext";
import { usePoof } from "../poofContext";

export default function SoundsPage() {
  const onPoof = usePoof();
  const { pitch, setPitch, length, setLength, echo, setEcho, resetFx } = useFx();

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordInterval = useRef<number | null>(null);

  // FX card visibility (lives on this page)
  const [showFx, setShowFx] = useState(false);

  // Active animal for the brief scale animation
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTimer = useRef<number | null>(null);

  // Stop button only shows when something is actually playing.
  const [anySoundPlaying, setAnySoundPlaying] = useState(false);
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

  // Sync FX to engine.
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

  // Tap an animal → play a random fart
  const onTapAnimal = useCallback(
    (id: string, emoji: string, e: React.MouseEvent | React.TouchEvent) => {
      void playRandomFart();
      setActiveId(id);
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
      activeTimer.current = window.setTimeout(() => {
        setActiveId((cur) => (cur === id ? null : cur));
      }, 300);
      const point = "touches" in e
        ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
        : (e as any);
      onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, emoji);
    },
    [onPoof]
  );

  // Record button toggle. Auto-saves a local recording (used later by
  // MySoundsPage / ProfilePage). For now just saves to localStorage so
  // it's available across tabs.
  const onToggleRecord = useCallback(async () => {
    if (recording) {
      const result = await stopRecording();
      setRecording(false);
      if (result && result.duration > 0.2) {
        const url = URL.createObjectURL(result.blob);
        // Save to local pending-upload queue
        const pending = JSON.parse(localStorage.getItem("emoji-farts-pending") || "[]");
        pending.push({
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
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
      } catch (err: any) {
        console.warn("mic denied:", err?.message || err);
        alert("Need microphone permission to record.");
      }
    }
  }, [recording, onPoof]);

  return (
    <div className="flex flex-col h-full">
      {/* Animal grid */}
      <main className="flex-1 px-3 pb-44 max-w-3xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ANIMALS.map((a) => (
            <AnimalTile
              key={a.id}
              animal={a}
              active={activeId === a.id}
              onTap={onTapAnimal}
            />
          ))}
        </div>
      </main>

      {/* FX card — collapsible */}
      {showFx && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-3">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl border-2 border-amber-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-amber-900">🎚️ Make it funny</h2>
              <button onClick={() => setShowFx(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold active:scale-95">✕</button>
            </div>
            <SliderRow emoji={pitch < 0.8 ? "🐢" : pitch > 1.2 ? "🐿️" : "😐"} label="Pitch" value={pitch} min={0.5} max={2.0} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setPitch} onReset={() => setPitch(1.0)} />
            <SliderRow emoji={length < 0.8 ? "⚡" : length > 1.2 ? "🐌" : "⏱️"} label="Length" value={length} min={0.5} max={2.0} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setLength} onReset={() => setLength(1.0)} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEcho(!echo)} className={`flex-1 font-bold text-sm py-3 rounded-xl border-2 active:scale-95 ${echo ? "bg-cyan-100 text-cyan-900 border-cyan-400" : "bg-white text-slate-600 border-slate-200"}`}>
                🚿 Bathroom Echo {echo ? "ON" : "OFF"}
              </button>
              <button onClick={resetFx} className="px-4 font-bold text-sm py-3 rounded-xl border-2 bg-white text-slate-600 border-slate-200 active:scale-95" title="Reset all">↺</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer — FX + Stop + Make a sound + Random */}
      <footer
        className="fixed bottom-14 left-0 right-0 z-30 p-2 bg-gradient-to-t from-white via-white/95 to-transparent"
        style={{ paddingBottom: "0.25rem" }}
      >
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button
            onClick={() => setShowFx(!showFx)}
            className={`w-12 h-12 rounded-2xl text-2xl active:scale-95 flex items-center justify-center shadow border-2 ${
              showFx ? "bg-amber-100 border-amber-400" : "bg-white border-slate-200"
            }`}
            title="FX"
            aria-label="FX"
          >
            🎚️
          </button>
          {anySoundPlaying && (
            <button
              onClick={() => {
                stopAllSounds();
                onPoof(window.innerWidth / 2, window.innerHeight / 2, "⏹");
                setAnySoundPlaying(false);
              }}
              className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 border-2 border-red-400 text-2xl active:scale-95 flex items-center justify-center shadow animate-pulse"
              title="Stop all sounds"
              aria-label="Stop"
            >
              ⏹
            </button>
          )}
          <button
            onClick={onToggleRecord}
            className={`flex-1 font-extrabold text-sm py-3 rounded-2xl shadow-lg border-2 border-white active:scale-95 ${recording ? "bg-red-500 text-white" : "bg-gradient-to-br from-pink-500 to-purple-500 text-white"}`}
          >
            {recording ? `⏹  Stop (${recordSeconds.toFixed(1)}s / ${MAX_RECORDING_SEC}s)` : "🎤  Make a sound"}
          </button>
          <button
            onClick={(e) => {
              void playRandomFart();
              const point = "touches" in e
                ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
                : (e as any);
              onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, "🎲");
            }}
            className="w-12 h-12 rounded-2xl bg-white border-2 border-amber-300 text-2xl active:scale-95 flex items-center justify-center shadow"
            title="Random fart"
            aria-label="Random fart"
          >
            🎲
          </button>
        </div>
      </footer>
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
        <button onClick={onReset} className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md active:scale-95">
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

function AnimalTile({
  animal, active, onTap,
}: {
  animal: Animal;
  active: boolean;
  onTap: (id: string, emoji: string, e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <button
      onClick={(e) => onTap(animal.id, animal.emoji, e)}
      style={{ touchAction: "manipulation" }}
      className={`relative aspect-square rounded-3xl bg-gradient-to-br ${animal.color} shadow-xl border-4 border-white/70 active:scale-95 select-none`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none">
        <div className={`text-6xl sm:text-7xl transition-transform ${active ? "scale-90" : ""}`}>
          {animal.emoji}
        </div>
        <div className="mt-1 text-base sm:text-lg font-bold text-amber-950 drop-shadow truncate max-w-full">
          {animal.name}
        </div>
      </div>
    </button>
  );
}
