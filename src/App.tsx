import { useState, useCallback, useEffect, useRef } from "react";
import {
  PRESETS,
  playFart,
  playCombo,
  randomPreset,
  primeAudio,
  type FartPreset,
} from "./audio/fartEngine";

type Poof = { id: number; x: number; y: number; emoji: string };

const HYPE_LABELS = [
  "Calm wind",
  "Whisper toot",
  "Solid rip",
  "HILARIOUS rip",
  "ROOM-CLEARER",
  "EVACUATE THE PREMISES",
];

export default function App() {
  const [poofs, setPoofs] = useState<Poof[]>([]);
  const [shake, setShake] = useState(false);
  const [hype, setHype] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const lastTriggerRef = useRef<{ [k: string]: number }>({});

  useEffect(() => {
    if (hype <= 0) return;
    const t = setTimeout(() => setHype((h) => Math.max(0, h - 1)), 4000);
    return () => clearTimeout(t);
  }, [hype]);

  const trigger = useCallback((preset: FartPreset, e?: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (lastTriggerRef.current[preset.id] && now - lastTriggerRef.current[preset.id] < 300) {
      return; // Debounce: pointerdown + click both fire
    }
    lastTriggerRef.current[preset.id] = now;

    // Prime (unlock iOS audio) BEFORE playing — first-tap path
    void primeAudio();

    try {
      playFart(preset);
    } catch (err) {
      // Audio engine should never crash the UI
      console.warn("[fart] audio error:", err);
    }

    // Spawn poof at tap location
    const point =
      "touches" in (e as any)
        ? (e as any).changedTouches?.[0]
        : (e as any);
    const x = point?.clientX ?? window.innerWidth / 2;
    const y = point?.clientY ?? window.innerHeight / 2;
    const id = Date.now() + Math.random();
    setPoofs((p) => [...p, { id, x, y, emoji: "💨" }]);
    setTimeout(() => {
      setPoofs((p) => p.filter((pf) => pf.id !== id));
    }, 800);

    setShake(true);
    setTimeout(() => setShake(false), 400);
    setActive(preset.id);
    setTimeout(() => setActive(null), 200);
    setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
  }, []);

  const lastActionRef = useRef<{ random: number; combo: number }>({
    random: 0,
    combo: 0,
  });

  const onRandom = useCallback(() => {
    const now = Date.now();
    if (now - lastActionRef.current.random < 400) return;
    lastActionRef.current.random = now;
    const p = randomPreset();
    trigger(p);
  }, [trigger]);

  const onCombo = useCallback(() => {
    const now = Date.now();
    if (now - lastActionRef.current.combo < 800) return;
    lastActionRef.current.combo = now;
    const count = 3 + Math.floor(Math.random() * 3);
    const picks: FartPreset[] = [];
    for (let i = 0; i < count; i++) picks.push(randomPreset());
    playCombo(picks);
    picks.forEach((_, i) => {
      setTimeout(() => {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
      }, i * 220);
    });
  }, []);

  const hypePct = (hype / (HYPE_LABELS.length - 1)) * 100;
  const hypeColor =
    hype < 2
      ? "bg-green-400"
      : hype < 4
      ? "bg-yellow-400"
      : "bg-red-500";

  return (
    <div
      className={`min-h-screen w-full flex flex-col ${
        shake ? "animate-shake" : ""
      }`}
    >
      {/* Header */}
      <header className="px-4 pt-6 pb-3 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 drop-shadow-sm">
          💥 ANIMAL FARTS 💥
        </h1>
        <p className="text-amber-800 text-base sm:text-lg mt-1 font-semibold">
          Tap an animal. Brace yourself.
        </p>
      </header>

      {/* Hype Meter */}
      <div className="px-4 pb-3">
        <div className="bg-white/60 backdrop-blur rounded-2xl p-3 shadow-lg border-2 border-amber-300">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold text-amber-900">💨 HYPE METER</span>
            <span className="text-xs font-bold text-amber-900">
              {HYPE_LABELS[hype]}
            </span>
          </div>
          <div className="w-full h-4 bg-amber-100 rounded-full overflow-hidden border-2 border-amber-300">
            <div
              className={`h-full ${hypeColor} transition-all duration-300 ease-out`}
              style={{ width: `${hypePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Animal Grid */}
      <main className="flex-1 px-3 pb-4">
        <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onPointerDown={(e) => trigger(p, e)}
              onClick={(e) => {
                // Fallback for environments where pointerdown is suppressed
                if (active !== p.id) trigger(p, e);
              }}
              className={`relative aspect-square rounded-3xl bg-gradient-to-br ${
                p.color
              } shadow-xl border-4 border-white/70 active:scale-95 transition-transform ${
                active === p.id ? "scale-95" : ""
              }`}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                <div
                  className={`text-6xl sm:text-7xl ${
                    active === p.id ? "animate-wiggle" : ""
                  }`}
                >
                  {p.emoji}
                </div>
                <div className="mt-1 text-lg sm:text-xl font-bold text-amber-950 drop-shadow">
                  {p.name}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-amber-900/80 uppercase tracking-wider">
                  {p.caption}
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* Action Bar */}
      <footer className="p-3 bg-gradient-to-t from-amber-200 to-transparent">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button
            onPointerDown={onRandom}
            onClick={() => onRandom()}
            className="flex-1 bg-gradient-to-br from-purple-400 to-pink-500 active:scale-95 transition-transform text-white font-bold text-lg py-4 rounded-2xl shadow-xl border-4 border-white"
          >
            🎲 RANDOM
          </button>
          <button
            onPointerDown={onCombo}
            onClick={() => onCombo()}
            className="flex-1 bg-gradient-to-br from-orange-500 to-red-500 active:scale-95 transition-transform text-white font-bold text-lg py-4 rounded-2xl shadow-xl border-4 border-white"
          >
            💥 COMBO
          </button>
        </div>
      </footer>

      {/* Poof particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {poofs.map((p) => (
          <div
            key={p.id}
            className="absolute text-4xl animate-poof"
            style={{ left: p.x - 20, top: p.y - 20 }}
          >
            {p.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}
