import { useState, useEffect, useCallback, useRef } from "react";
import {
  FLAVORS,
  FLAVOR_LABELS,
  playRandomFart,
  setPitchRate,
  setEchoAmount,
  setLengthScale,
  type Flavor,
} from "./audio/fartEngine";

export default function App() {
  // Active flavor filters. Empty set = all flavors enabled.
  const [activeFlavors, setActiveFlavors] = useState<Set<Flavor>>(new Set());
  // FX
  const [pitch, setPitch] = useState(1.0);
  const [length, setLength] = useState(1.0);
  const [echo, setEcho] = useState(false);
  // Show/hide the FX card
  const [showFx, setShowFx] = useState(false);
  // 💨 poof at tap point
  const [poofs, setPoofs] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const nextPoofId = useRef(0);
  // Active animal (for the brief scale animation)
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTimer = useRef<number | null>(null);

  // Sync FX to engine
  useEffect(() => { setPitchRate(pitch); }, [pitch]);
  useEffect(() => { setLengthScale(length); }, [length]);
  useEffect(() => { setEchoAmount(echo ? 1 : 0); }, [echo]);

  // 💨 Poof
  const spawnPoof = useCallback((x: number, y: number, emoji: string) => {
    const id = nextPoofId.current++;
    setPoofs((p) => [...p.slice(-5), { id, x, y, emoji }]);
    window.setTimeout(() => {
      setPoofs((p) => p.filter((pf) => pf.id !== id));
    }, 700);
  }, []);

  // Animal tap → play random fart + emoji flash + poof
  const onTapAnimal = useCallback(
    (id: string, emoji: string, e: React.MouseEvent | React.TouchEvent) => {
      void playRandomFart(activeFlavors);
      setActiveId(id);
      if (activeTimer.current) window.clearTimeout(activeTimer.current);
      activeTimer.current = window.setTimeout(() => {
        setActiveId((cur) => (cur === id ? null : cur));
      }, 300);
      const point = "touches" in e
        ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
        : (e as any);
      spawnPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, emoji);
    },
    [activeFlavors, spawnPoof]
  );

  // Flavor toggle
  const toggleFlavor = useCallback((f: Flavor) => {
    setActiveFlavors((cur) => {
      const next = new Set(cur);
      // If all flavors are enabled (empty set = "all"), clicking a flavor
      // disables ONLY that one — i.e., the user is filtering down.
      // If clicking a flavor that's already disabled, re-enable it.
      if (cur.size === 0) {
        // "all" mode: disable this one (new set has the other 5)
        for (const x of FLAVORS) {
          if (x !== f) next.add(x);
        }
        return next;
      }
      if (next.has(f)) {
        next.delete(f);
      } else {
        next.add(f);
      }
      // If we've re-enabled everything, go back to "all" mode (empty set)
      if (next.size === FLAVORS.length) return new Set();
      return next;
    });
  }, []);

  const flavorsActive = activeFlavors.size > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="px-3 pt-3 pb-2 flex items-center justify-center">
        <h1 className="text-2xl font-bold text-amber-900">💨 Emoji Farts</h1>
      </header>

      {/* Flavor filter chips — show what's currently active */}
      <div className="px-3 pb-2 flex gap-1.5 flex-wrap justify-center max-w-3xl mx-auto">
        {FLAVORS.map((f) => {
          // "active" = included in the random pool
          const isActive = !flavorsActive || activeFlavors.has(f);
          return (
            <button
              key={f}
              onClick={() => toggleFlavor(f)}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 active:scale-95 transition-colors ${
                isActive
                  ? "bg-amber-100 text-amber-900 border-amber-400"
                  : "bg-white text-slate-400 border-slate-200"
              }`}
              aria-pressed={isActive}
            >
              {FLAVOR_LABELS[f]}
            </button>
          );
        })}
      </div>

      {/* Main: animal grid */}
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

      {/* FX card — collapsed by default. Tap the 🎚️ button to expand. */}
      {showFx && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-3">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl border-2 border-amber-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-amber-900">🎚️ Make it funny</h2>
              <button onClick={() => setShowFx(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold active:scale-95">✕</button>
            </div>

            {/* Pitch */}
            <SliderRow
              emoji={pitch < 0.8 ? "🐢" : pitch > 1.2 ? "🐿️" : "😐"}
              label="Pitch"
              value={pitch}
              min={0.5}
              max={2.0}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={setPitch}
              onReset={() => setPitch(1.0)}
            />

            {/* Length */}
            <SliderRow
              emoji={length < 0.8 ? "⚡" : length > 1.2 ? "🐌" : "⏱️"}
              label="Length"
              value={length}
              min={0.5}
              max={2.0}
              step={0.05}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={setLength}
              onReset={() => setLength(1.0)}
            />

            {/* Toggles row */}
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
                onClick={() => { setPitch(1.0); setLength(1.0); setEcho(false); setActiveFlavors(new Set()); }}
                className="px-4 font-bold text-sm py-3 rounded-xl border-2 bg-white text-slate-600 border-slate-200 active:scale-95"
                title="Reset all"
              >
                ↺
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: FX toggle + random button */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button
            onClick={() => setShowFx(!showFx)}
            className={`w-14 h-14 rounded-2xl text-2xl active:scale-95 flex items-center justify-center shadow border-2 ${
              showFx ? "bg-amber-100 border-amber-400" : "bg-white border-slate-200"
            }`}
            title="FX"
            aria-label="FX"
          >
            🎚️
          </button>
          <button
            onClick={(e) => {
              // "Random" — play a random fart, with a big poof
              void playRandomFart(activeFlavors);
              const point = "touches" in e
                ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
                : (e as any);
              spawnPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, "🎲");
            }}
            className="flex-1 font-extrabold text-base py-4 rounded-2xl shadow-lg border-2 border-white active:scale-95 bg-gradient-to-br from-pink-500 to-purple-500 text-white"
          >
            🎲 Random fart
          </button>
        </div>
      </footer>

      {/* 💨 Poofs */}
      {poofs.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed text-3xl poof-rise"
          style={{ left: p.x - 12, top: p.y - 12, zIndex: 50 }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}

function SliderRow({
  emoji, label, value, min, max, step, format, onChange, onReset,
}: {
  emoji: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  onReset: () => void;
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
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
        style={{ touchAction: "manipulation" }}
      />
    </div>
  );
}

// === Animal list ===
// Same 37 animals as before, but now the audio is a real MyInstants
// fart (random pick), not a per-animal synth/sample.
type Animal = { id: string; name: string; emoji: string; color: string };

const ANIMALS: Animal[] = [
  { id: "cow", name: "Cow", emoji: "🐄", color: "from-pink-200 to-pink-400" },
  { id: "dog", name: "Dog", emoji: "🐕", color: "from-amber-200 to-amber-400" },
  { id: "cat", name: "Cat", emoji: "🐈", color: "from-purple-200 to-purple-400" },
  { id: "bird", name: "Bird", emoji: "🐦", color: "from-sky-200 to-sky-400" },
  { id: "horse", name: "Horse", emoji: "🐎", color: "from-orange-200 to-orange-400" },
  { id: "pig", name: "Pig", emoji: "🐖", color: "from-rose-200 to-rose-400" },
  { id: "duck", name: "Duck", emoji: "🦆", color: "from-yellow-200 to-yellow-400" },
  { id: "elephant", name: "Elephant", emoji: "🐘", color: "from-slate-300 to-slate-500" },
  { id: "monkey", name: "Monkey", emoji: "🐒", color: "from-lime-200 to-lime-400" },
  { id: "snake", name: "Snake", emoji: "🐍", color: "from-emerald-200 to-emerald-400" },
  { id: "lion", name: "Lion", emoji: "🦁", color: "from-yellow-300 to-amber-500" },
  { id: "frog", name: "Frog", emoji: "🐸", color: "from-green-300 to-green-500" },
  { id: "bull", name: "Bull", emoji: "🐂", color: "from-red-300 to-red-500" },
  { id: "rabbit", name: "Rabbit", emoji: "🐰", color: "from-pink-100 to-pink-300" },
  { id: "bear", name: "Bear", emoji: "🐻", color: "from-amber-500 to-orange-700" },
  { id: "rooster", name: "Rooster", emoji: "🐓", color: "from-red-200 to-orange-300" },
  { id: "turtle", name: "Turtle", emoji: "🐢", color: "from-emerald-300 to-emerald-500" },
  { id: "whale", name: "Whale", emoji: "🐋", color: "from-blue-300 to-blue-500" },
  { id: "goat", name: "Goat", emoji: "🐐", color: "from-stone-300 to-stone-500" },
  { id: "sheep", name: "Sheep", emoji: "🐑", color: "from-gray-200 to-gray-400" },
  { id: "bee", name: "Bee", emoji: "🐝", color: "from-yellow-300 to-yellow-500" },
  { id: "turkey", name: "Turkey", emoji: "🦃", color: "from-red-400 to-red-600" },
  { id: "owl", name: "Owl", emoji: "🦉", color: "from-indigo-300 to-indigo-500" },
  { id: "penguin", name: "Penguin", emoji: "🐧", color: "from-cyan-200 to-cyan-400" },
  { id: "seal", name: "Seal", emoji: "🦭", color: "from-slate-200 to-slate-400" },
  { id: "hippo", name: "Hippo", emoji: "🦛", color: "from-pink-300 to-purple-400" },
  { id: "rhino", name: "Rhino", emoji: "🦏", color: "from-stone-400 to-stone-600" },
  { id: "zebra", name: "Zebra", emoji: "🦓", color: "from-gray-100 to-gray-300" },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", color: "from-yellow-200 to-amber-300" },
  { id: "moose", name: "Moose", emoji: "🦌", color: "from-amber-500 to-orange-600" },
  { id: "kangaroo", name: "Kangaroo", emoji: "🦘", color: "from-orange-300 to-orange-500" },
  { id: "sloth", name: "Sloth", emoji: "🦥", color: "from-lime-200 to-amber-200" },
  { id: "skunk", name: "Skunk", emoji: "🦨", color: "from-gray-300 to-gray-500" },
  { id: "raccoon", name: "Raccoon", emoji: "🦝", color: "from-stone-300 to-stone-500" },
  { id: "mammoth", name: "Mammoth", emoji: "🦣", color: "from-stone-500 to-stone-700" },
  { id: "megaLion", name: "Mega-Lion", emoji: "🦁", color: "from-amber-400 to-red-600" },
  { id: "python", name: "Python", emoji: "🐍", color: "from-emerald-400 to-emerald-600" },
];

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
