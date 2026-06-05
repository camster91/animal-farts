import { useState, useEffect, useCallback, useRef } from "react";
import {
  playSound,
  playRandomFart,
  stopAllSounds,
  setPitchRate,
  setEchoAmount,
  setLengthScale,
  startRecording,
  stopRecording,
  MAX_RECORDING_SEC,
} from "../audio/fartEngine";
import { TILES, FILTERS, type Tile } from "../animals";
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
  // Filter chip selection. v25t: 9 chips (all + animal + 6 flavors + fun).
  // Each chip's groups[] tells us which TILES.group values to include.
  // v25t default is "animal" so the page is ~49 tiles instead of 388.
  // Kids tap "All" or any other chip to expand the grid.
  type Filter = typeof FILTERS[number]["id"];
  const [filter, setFilter] = useState<Filter>("animal");
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

  // Tap a tile → play that tile's unique sound.
  // v25s: the tile has its own `sound` field (different emoji = different
  // sound). Same tile = same sound every time. playSound calls
  // stopActiveElements() first, so consecutive taps just restart the
  // sound without layering.
  const onTapTile = useCallback(
    (tile: Tile, e: React.MouseEvent | React.TouchEvent) => {
      void playSound(tile.sound);
      setActiveId(tile.id);
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
      activeTimer.current = window.setTimeout(() => {
        setActiveId((cur) => (cur === tile.id ? null : cur));
      }, 300);
      const point = "touches" in e
        ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
        : (e as any);
      onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, tile.emoji);
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
      {/* Animal grid. v25r: pb-72 (288px) cleared the footer but not the
          FX card when open. FX card top ≈ 374px from bottom + 16px gap
          = 390px. We use 400px (rounded). */}
      <main className="flex-1 px-3 pb-[400px] max-w-3xl mx-auto w-full">
        {/* Filter chips — v25t: 9 chips. The "All" chip shows all 388 tiles.
            Animal / Wet / Dry / Echo / Long / Bubbly / Squeaky / Fun are
            the 8 flavor categories. */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              emoji={f.emoji}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
        </div>
        {/* v25t: 4-column grid on mobile (was 2-col). Tiles are smaller
            so 49 animal tiles fit on one screen and even 388 flavor
            tiles scroll smoothly without jank. */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {TILES.filter((t) => {
            const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
            return f.groups == null || f.groups.includes(t.group);
          }).map((t) => (
            <TileView
              key={t.id}
              tile={t}
              active={activeId === t.id}
              onTap={onTapTile}
            />
          ))}
        </div>
      </main>

      {/* FX card — sits ABOVE the footer (which is bottom-14 ≈ 56px gap,
          ~64px tall, so its top is at ~120px). v25r used bottom-20 (80px)
          which crashed the FX card's bottom into the footer. Bottom-[124px]
          leaves 4px breathing room. The card is ~250px tall, so its top is
          at ~374px from the bottom of the viewport. */}
      {showFx && (
        <div
          className="fixed inset-x-0 z-40 px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 124px)" }}
        >
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

// v25t: Tile is now self-contained (no separate Animal lookup). It
// has its own emoji, name, and color. We pick a color per group.
function tileColor(t: Tile): string {
  switch (t.group) {
    case 'animal':  return 'from-amber-200 to-orange-300';
    case 'wet':     return 'from-blue-200 to-cyan-300';
    case 'dry':     return 'from-yellow-200 to-amber-300';
    case 'echo':    return 'from-purple-200 to-indigo-300';
    case 'long':    return 'from-emerald-200 to-teal-300';
    case 'bubbly':  return 'from-sky-200 to-blue-300';
    case 'squeaky': return 'from-rose-200 to-pink-300';
    case 'other':   return 'from-violet-200 to-purple-300';
    default:        return 'from-amber-200 to-orange-300';
  }
}

function TileView({
  tile, active, onTap,
}: {
  tile: Tile;
  active: boolean;
  onTap: (tile: Tile, e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <button
      onClick={(e) => onTap(tile, e)}
      style={{ touchAction: "manipulation" }}
      className={`relative aspect-square rounded-2xl bg-gradient-to-br ${tileColor(tile)} shadow-md border-2 border-white/70 active:scale-95 select-none`}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`text-3xl sm:text-4xl transition-transform ${active ? "scale-90" : ""}`}>
          {tile.emoji}
        </div>
      </div>
      {/* Name tooltip only on tap (v25t: too small for inline labels). */}
      {active && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-amber-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg z-10">
          {tile.name}
        </div>
      )}
    </button>
  );
}

// Horizontal filter pill — picks a category of animals to show.
function FilterChip({ label, emoji, active, onClick }: {
  label: string; emoji: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-2 active:scale-95 transition-colors ${
        active
          ? "bg-amber-500 text-white border-amber-500"
          : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
      }`}
    >
      <span className="mr-1">{emoji}</span>
      {label}
    </button>
  );
}
