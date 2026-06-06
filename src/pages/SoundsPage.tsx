// v25w: scene + grid layout. The page shows:
//   1. A row of scene chips (Farm, Jungle, Ocean, City, Bedroom, Bathroom)
//   2. The selected scene's illustration as the background
//   3. A grid of emoji tiles in the foreground (5-col mobile)
//
// Each tile is a cluster from the catalog (e.g. 🐄 Cow). Tap = random
// sound from the cluster's bucket. Different tile = different sound.
//
// Bottom nav stays for parents to access My/Explore/Profile. Stop
// + Record buttons are floating.

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SCENE_LIST,
  SCENE_LAYOUTS,
  SceneBackground,
  findCluster,
  type SceneId,
  type Cluster,
} from "../scenes";
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

export default function SoundsPage() {
  const onPoof = usePoof();
  const { pitch, setPitch, length, setLength, echo, setEcho, resetFx } = useFx();

  // Which scene is selected
  const [sceneId, setSceneId] = useState<SceneId>("farm");
  const layout = SCENE_LAYOUTS[sceneId];
  const scene = layout.scene;
  const tiles = layout.tiles
    .map((id) => findCluster(id))
    .filter((c): c is Cluster => c !== null);

  // Active tile (scale animation)
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTimer = useRef<number | null>(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordInterval = useRef<number | null>(null);

  // Parental controls
  const [showKidsMenu, setShowKidsMenu] = useState(false);
  const [showFx, setShowFx] = useState(false);
  const [anySoundPlaying, setAnySoundPlaying] = useState(false);
  const gearTimer = useRef<number | null>(null);

  // FX sync
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

  // Stop button visibility
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

  // Tap a tile → play a random sound from its cluster's bucket
  const onTapCluster = useCallback(
    (cluster: Cluster, e: React.MouseEvent | React.TouchEvent) => {
      const sound = cluster.sounds[Math.floor(Math.random() * cluster.sounds.length)];
      void playSound(sound);
      setActiveId(cluster.id);
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
      activeTimer.current = window.setTimeout(() => {
        setActiveId((cur) => (cur === cluster.id ? null : cur));
      }, 350);
      const point = "touches" in e
        ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
        : (e as any);
      onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, cluster.emoji);
    },
    [onPoof]
  );

  // Parental gear: long-press top-left to reveal
  const onGearTouchStart = useCallback(() => {
    gearTimer.current = window.setTimeout(() => setShowKidsMenu(true), 1200);
  }, []);
  const onGearTouchEnd = useCallback(() => {
    if (gearTimer.current) {
      window.clearTimeout(gearTimer.current);
      gearTimer.current = null;
    }
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

  return (
    <SceneBackground scene={scene}>
      {/* Scene chips (top, semi-transparent) */}
      <div className="flex gap-1.5 px-2 py-2 overflow-x-auto shrink-0">
        {SCENE_LIST.map((s) => (
          <button
            key={s.id}
            onClick={() => setSceneId(s.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 active:scale-95 transition-colors backdrop-blur-md ${
              s.id === sceneId
                ? "bg-amber-500 text-white border-amber-500 shadow"
                : "bg-white/40 text-slate-800 border-white/50"
            }`}
          >
            <span className="mr-1">{s.emoji}</span>
            {s.name}
          </button>
        ))}
      </div>

      {/* Tile grid (3-col mobile, 4-col tablet, 5-col desktop) */}
      <div className="flex-1 overflow-y-auto px-3 pb-32">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-w-3xl mx-auto">
          {tiles.map((cluster) => (
            <ClusterTile
              key={cluster.id}
              cluster={cluster}
              active={activeId === cluster.id}
              onTap={onTapCluster}
            />
          ))}
        </div>
      </div>

      {/* Hidden parental gear trigger (top-left corner) */}
      <div
        className="absolute top-0 left-0 w-20 h-20 z-20"
        onTouchStart={onGearTouchStart}
        onTouchEnd={onGearTouchEnd}
        onMouseDown={onGearTouchStart}
        onMouseUp={onGearTouchEnd}
        onMouseLeave={onGearTouchEnd}
      />

      {/* Stop button (when sound playing) — bottom-right */}
      {anySoundPlaying && !recording && (
        <button
          onClick={() => {
            stopAllSounds();
            onPoof(window.innerWidth / 2, window.innerHeight / 2, "⏹");
            setAnySoundPlaying(false);
          }}
          className="absolute bottom-20 right-4 w-12 h-12 rounded-full bg-red-500 text-white text-2xl shadow-lg z-30 active:scale-90 animate-pulse"
          aria-label="Stop all sounds"
        >
          ⏹
        </button>
      )}

      {/* Record button — bottom-left, semi-transparent */}
      <button
        onClick={onToggleRecord}
        className={`absolute bottom-20 left-4 w-12 h-12 rounded-full text-2xl shadow-lg z-30 active:scale-90 ${
          recording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-white/60 backdrop-blur-md text-amber-900"
        }`}
        aria-label={recording ? "Stop recording" : "Record"}
      >
        {recording ? `⏹${recordSeconds.toFixed(0)}` : "🎤"}
      </button>

      {/* Parents overlay (long-press top-left to reveal) */}
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
              onClick={() => setShowFx(!showFx)}
              className="w-full mb-2 py-3 rounded-xl font-bold bg-amber-100 text-amber-900 active:scale-95"
            >
              🎚️ Make it funny (FX)
            </button>
            <button
              onClick={() => {
                const t = tiles[Math.floor(Math.random() * tiles.length)];
                if (t) onTapCluster(t, { touches: [{ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }], changedTouches: [{ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }] } as any);
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
    </SceneBackground>
  );
}

function ClusterTile({
  cluster, active, onTap,
}: {
  cluster: Cluster;
  active: boolean;
  onTap: (cluster: Cluster, e: React.MouseEvent | React.TouchEvent) => void;
}) {
  // Subtle translucent tile so the scene background shows through.
  // The tile has a soft glassy look — kid sees the scene + the emoji.
  return (
    <button
      onClick={(e) => onTap(cluster, e)}
      style={{ touchAction: "manipulation" }}
      className="relative aspect-square rounded-2xl bg-white/30 backdrop-blur-md border-2 border-white/60 shadow-md active:scale-95 select-none"
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-1 pointer-events-none">
        <div className={`text-4xl sm:text-5xl transition-transform ${active ? "scale-125 drop-shadow-lg" : "drop-shadow"}`}>
          {cluster.emoji}
        </div>
        <div className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-white drop-shadow-md truncate max-w-full text-center leading-tight">
          {cluster.name}
        </div>
        {cluster.sounds.length > 1 && (
          <div className="absolute top-1 right-1 bg-amber-900/80 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {cluster.sounds.length > 99 ? "99+" : cluster.sounds.length}
          </div>
        )}
      </div>
    </button>
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
