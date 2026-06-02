import { useState, useCallback, useEffect, useRef } from "react";
import {
  PRESETS,
  OHNO_PRESETS,
  playFart,
  primeAudio,
  startRecording,
  stopRecording,
  loadRecordings,
  saveRecording,
  deleteRecording,
  loadTapCounts,
  recordTap,
  setCardLoop,
  loadCardLoops,
  setReverbMode,
  stopAllSounds,
  playBlobWithFx,
  type FartPreset,
  type CustomRecording,
} from "./audio/fartEngine";

type Poof = { id: number; x: number; y: number; emoji: string };
type Tab = "animals" | "ohnos" | "myfarts";

const HYPE_LABELS = [
  "Calm wind", "Whisper toot", "Solid rip", "HILARIOUS rip",
  "ROOM-CLEARER", "EVACUATE THE PREMISES",
];

const EMOJI_CHOICES = ["💨", "🎤", "🤪", "😈", "👻", "👽", "💀", "🤡", "🦄", "🐸", "🐵", "🐷", "🐮", "🐔", "🐧", "🐢", "🐬", "🦖"];

export default function App() {
  const [tab, setTab] = useState<Tab>("animals");
  const [poofs, setPoofs] = useState<Poof[]>([]);
  const [shake, setShake] = useState(false);
  const [hype, setHype] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<CustomRecording[]>([]);
  const [tapCounts, setTapCounts] = useState<Record<string, number>>({});
  const [cardLoops, setCardLoops] = useState<Record<string, boolean>>({});
  const [reverbMode, setReverbModeState] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number; blob: Blob } | null>(null);
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmoji, setNewRecEmoji] = useState("💨");
  const [recordError, setRecordError] = useState<string | null>(null);
  const lastTriggerRef = useRef<{ [k: string]: number }>({});
  const lastActionRef = useRef<{ random: number; combo: number }>({ random: 0, combo: 0 });
  const recordTimerRef = useRef<number | null>(null);

  // Load on mount
  useEffect(() => {
    setRecordings(loadRecordings());
    setTapCounts(loadTapCounts());
    setCardLoops(loadCardLoops());
  }, []);

  // Hype decay
  useEffect(() => {
    if (hype <= 0) return;
    const t = setTimeout(() => setHype((h) => Math.max(0, h - 1)), 4000);
    return () => clearTimeout(t);
  }, [hype]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration((d) => d + 0.1);
      }, 100);
    } else if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [recording]);

  const trigger = useCallback((preset: FartPreset, e?: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (lastTriggerRef.current[preset.id] && now - lastTriggerRef.current[preset.id] < 300) {
      return;
    }
    lastTriggerRef.current[preset.id] = now;

    void primeAudio();

    const looping = cardLoops[preset.id] ?? false;
    try {
      if (looping) stopAllSounds();
      playFart(preset, { loop: looping });
    } catch (err) {
      console.warn("[fart] audio error:", err);
    }

    // Track taps for favorites
    const newCounts = recordTap(preset.id);
    setTapCounts(newCounts);

    // Poof particle
    const point = "touches" in (e as any) ? (e as any).changedTouches?.[0] : (e as any);
    const x = point?.clientX ?? window.innerWidth / 2;
    const y = point?.clientY ?? window.innerHeight / 2;
    const id = Date.now() + Math.random();
    setPoofs((p) => [...p, { id, x, y, emoji: "💨" }]);
    setTimeout(() => setPoofs((p) => p.filter((pf) => pf.id !== id)), 800);

    setShake(true);
    setTimeout(() => setShake(false), 400);
    setActive(preset.id);
    setTimeout(() => setActive(null), 200);
    setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
  }, [cardLoops]);

  const onRandom = useCallback(() => {
    const now = Date.now();
    if (now - lastActionRef.current.random < 400) return;
    lastActionRef.current.random = now;
    const pool = tab === "ohnos" ? OHNO_PRESETS : tab === "myfarts" ? [] : PRESETS;
    if (pool.length === 0) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    trigger(p);
  }, [tab, trigger]);

  const onCombo = useCallback(() => {
    const now = Date.now();
    if (now - lastActionRef.current.combo < 800) return;
    lastActionRef.current.combo = now;
    const pool = tab === "ohnos" ? OHNO_PRESETS : PRESETS;
    const count = 3 + Math.floor(Math.random() * 3);
    const picks: FartPreset[] = [];
    for (let i = 0; i < count; i++) picks.push(pool[Math.floor(Math.random() * pool.length)]);
    picks.forEach((p, i) => setTimeout(() => playFart(p), i * 220));
    picks.forEach((_, i) => setTimeout(() => {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
    }, i * 220));
  }, [tab]);

  const toggleLoop = useCallback((id: string) => {
    setCardLoops((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      setCardLoop(id, next[id]);
      if (!next[id]) stopAllSounds();
      return next;
    });
  }, []);

  const toggleReverb = useCallback(() => {
    setReverbModeState((prev) => {
      const next = !prev;
      setReverbMode(next);
      return next;
    });
  }, []);

  const onStartRecord = useCallback(async () => {
    setRecordError(null);
    setRecordDuration(0);
    try {
      await startRecording();
      setRecording(true);
    } catch (err: any) {
      setRecordError(err?.message || "Could not access microphone. Please allow mic access.");
    }
  }, []);

  const onStopRecord = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    const result = await stopRecording();
    if (result && result.duration > 0.2) {
      setPendingRecording({ url: result.url, duration: result.duration, blob: result.blob });
      setNewRecName(`My Fart ${recordings.length + 1}`);
      setNewRecEmoji("💨");
    }
  }, [recording, recordings.length]);

  const onSaveRecording = useCallback(() => {
    if (!pendingRecording) return;
    const rec = saveRecording({
      name: newRecName || "My Fart",
      emoji: newRecEmoji,
      url: pendingRecording.url,
    });
    setRecordings([...recordings, rec]);
    setPendingRecording(null);
    setShowRecordModal(false);
  }, [pendingRecording, newRecName, newRecEmoji, recordings]);

  const onDeleteRecording = useCallback((id: string) => {
    if (!confirm("Delete this recording?")) return;
    deleteRecording(id);
    setRecordings(recordings.filter((r) => r.id !== id));
  }, [recordings]);

  const onPlayCustom = useCallback(async (rec: CustomRecording) => {
    try {
      // Fetch the blob from the URL
      const resp = await fetch(rec.url);
      const blob = await resp.blob();
      const withReverb = !!(window as any).__reverbEnabled;
      await playBlobWithFx(blob, withReverb);
    } catch (err) {
      // Fallback: simple HTMLAudioElement
      const audio = new Audio(rec.url);
      audio.volume = 0.9;
      audio.play().catch(() => {});
    }
    setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  // Build sorted presets: favorites (top 3 by tap count) first
  const sortedPresets = (() => {
    if (tab !== "animals") return PRESETS;
    const top = PRESETS
      .filter((p) => (tapCounts[p.id] || 0) > 0)
      .sort((a, b) => (tapCounts[b.id] || 0) - (tapCounts[a.id] || 0))
      .slice(0, 3);
    const topIds = new Set(top.map((p) => p.id));
    return [...top, ...PRESETS.filter((p) => !topIds.has(p.id))];
  })();

  const hypePct = (hype / (HYPE_LABELS.length - 1)) * 100;
  const hypeColor = hype < 2 ? "bg-green-400" : hype < 4 ? "bg-yellow-400" : "bg-red-500";

  const currentPresets = tab === "ohnos" ? OHNO_PRESETS : sortedPresets;

  return (
    <div className={`min-h-screen w-full flex flex-col ${shake ? "animate-shake" : ""} ${reverbMode ? "bg-gradient-to-b from-cyan-100 to-blue-200" : ""}`} style={reverbMode ? { background: "linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)" } : undefined}>
      <header className="px-4 pt-6 pb-3 text-center">
        <h1 className={`text-4xl sm:text-5xl font-bold drop-shadow-sm ${reverbMode ? "text-blue-900" : "text-amber-900"}`}>
          💥 ANIMAL FARTS 💥
        </h1>
        <p className={`text-base sm:text-lg mt-1 font-semibold ${reverbMode ? "text-blue-800" : "text-amber-800"}`}>
          Tap an animal. Brace yourself.
        </p>
      </header>

      {/* Tabs */}
      <div className="px-3 pb-2 flex gap-2 max-w-3xl mx-auto w-full">
        <button
          onClick={() => setTab("animals")}
          className={`flex-1 py-2 rounded-xl font-bold text-sm ${tab === "animals" ? "bg-amber-500 text-white shadow-lg" : "bg-white/60 text-amber-900"}`}
        >
          🐾 Animals
        </button>
        <button
          onClick={() => setTab("ohnos")}
          className={`flex-1 py-2 rounded-xl font-bold text-sm ${tab === "ohnos" ? "bg-pink-500 text-white shadow-lg" : "bg-white/60 text-pink-900"}`}
        >
          😱 Oh No!
        </button>
        <button
          onClick={() => setTab("myfarts")}
          className={`flex-1 py-2 rounded-xl font-bold text-sm ${tab === "myfarts" ? "bg-purple-500 text-white shadow-lg" : "bg-white/60 text-purple-900"}`}
        >
          🎤 My Farts
        </button>
      </div>

      {/* Hype Meter */}
      <div className="px-4 pb-3">
        <div className="bg-white/60 backdrop-blur rounded-2xl p-3 shadow-lg border-2 border-amber-300">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold text-amber-900">💨 HYPE METER</span>
            <span className="text-xs font-bold text-amber-900">{HYPE_LABELS[hype]}</span>
          </div>
          <div className="w-full h-4 bg-amber-100 rounded-full overflow-hidden border-2 border-amber-300">
            <div className={`h-full ${hypeColor} transition-all duration-300 ease-out`} style={{ width: `${hypePct}%` }} />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={toggleReverb}
              className={`flex-1 text-xs py-1.5 px-2 rounded-lg font-bold ${reverbMode ? "bg-blue-500 text-white" : "bg-white text-blue-700 border border-blue-300"}`}
            >
              🚿 Bathroom {reverbMode ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => { stopAllSounds(); }}
              className="text-xs py-1.5 px-3 rounded-lg font-bold bg-white text-red-700 border border-red-300"
            >
              🛑 STOP
            </button>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <main className="flex-1 px-3 pb-4">
        {tab === "myfarts" ? (
          <div>
            <button
              onClick={() => { setShowRecordModal(true); setRecordError(null); }}
              className="w-full mb-3 py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-lg shadow-xl border-4 border-white active:scale-95"
            >
              🎤 RECORD A FART
            </button>
            {recordings.length === 0 ? (
              <div className="text-center text-purple-900/60 py-12 px-4">
                <div className="text-6xl mb-3">🎤</div>
                <p className="font-semibold">No recordings yet</p>
                <p className="text-sm">Tap the button above to record your first fart!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="relative aspect-square rounded-3xl bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 shadow-xl border-4 border-white"
                  >
                    <button
                      onClick={() => onPlayCustom(rec)}
                      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2 active:scale-95 transition-transform"
                    >
                      <div className="text-5xl sm:text-6xl">{rec.emoji}</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-purple-950 truncate max-w-full">{rec.name}</div>
                      <div className="text-[10px] font-semibold text-purple-900/80">{rec.id.toUpperCase()}</div>
                    </button>
                    <button
                      onClick={() => onDeleteRecording(rec.id)}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
            {currentPresets.map((p, idx) => {
              const isFavorite = tab === "animals" && idx < 3 && (tapCounts[p.id] || 0) > 0;
              const looping = cardLoops[p.id] ?? false;
              return (
                <button
                  key={p.id}
                  onPointerDown={(e) => trigger(p, e)}
                  onClick={(e) => { if (active !== p.id) trigger(p, e); }}
                  className={`relative aspect-square rounded-3xl bg-gradient-to-br ${p.color} shadow-xl border-4 border-white/70 active:scale-95 transition-transform ${active === p.id ? "scale-95" : ""}`}
                >
                  {isFavorite && (
                    <div className="absolute -top-1 -left-1 text-2xl z-10 drop-shadow-lg">⭐</div>
                  )}
                  {looping && (
                    <div className="absolute -top-1 -right-1 text-2xl z-10 drop-shadow-lg">🔁</div>
                  )}
                  {p.loopable && !looping && (
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleLoop(p.id); }}
                      className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white/80 text-xs font-bold flex items-center justify-center shadow-md active:scale-90 z-10"
                    >
                      ↻
                    </div>
                  )}
                  {looping && (
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleLoop(p.id); }}
                      className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90 z-10"
                    >
                      ✓
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    <div className={`text-5xl sm:text-6xl ${active === p.id ? "animate-wiggle" : ""}`}>{p.emoji}</div>
                    <div className="mt-1 text-sm sm:text-base font-bold text-amber-950 drop-shadow truncate max-w-full">{p.name}</div>
                    <div className="text-[9px] sm:text-[10px] font-semibold text-amber-900/80 uppercase tracking-wider truncate max-w-full">{p.caption}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Action Bar */}
      {tab !== "myfarts" && (
        <footer className="p-3 bg-gradient-to-t from-amber-200 to-transparent">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <button
              onPointerDown={onRandom}
              onClick={onRandom}
              className="flex-1 bg-gradient-to-br from-purple-400 to-pink-500 active:scale-95 transition-transform text-white font-bold text-lg py-4 rounded-2xl shadow-xl border-4 border-white"
            >
              🎲 RANDOM
            </button>
            <button
              onPointerDown={onCombo}
              onClick={onCombo}
              className="flex-1 bg-gradient-to-br from-orange-500 to-red-500 active:scale-95 transition-transform text-white font-bold text-lg py-4 rounded-2xl shadow-xl border-4 border-white"
            >
              💥 COMBO
            </button>
          </div>
        </footer>
      )}

      {/* Record Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            {!recording && !pendingRecording && (
              <div className="text-center">
                <div className="text-6xl mb-3">🎤</div>
                <h2 className="text-2xl font-bold text-purple-900 mb-2">Record a Fart</h2>
                <p className="text-gray-600 mb-4 text-sm">Tap the mic, then make your sound!</p>
                {recordError && (
                  <div className="bg-red-100 border-2 border-red-300 text-red-800 rounded-xl p-3 mb-4 text-sm">
                    {recordError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowRecordModal(false); setRecordError(null); }}
                    className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onStartRecord}
                    className="flex-1 py-3 rounded-xl bg-purple-500 text-white font-bold active:scale-95"
                  >
                    🎤 Start
                  </button>
                </div>
              </div>
            )}
            {recording && (
              <div className="text-center">
                <div className="text-6xl mb-3 animate-pulse">🔴</div>
                <h2 className="text-2xl font-bold text-red-600 mb-2">RECORDING</h2>
                <div className="text-3xl font-mono font-bold text-gray-800 mb-4">
                  {recordDuration.toFixed(1)}s
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-red-500 animate-pulse" style={{ width: "100%" }} />
                </div>
                <button
                  onClick={onStopRecord}
                  className="w-full py-4 rounded-xl bg-red-500 text-white font-bold text-lg active:scale-95"
                >
                  ⏹ STOP
                </button>
              </div>
            )}
            {pendingRecording && (
              <div className="text-center">
                <div className="text-5xl mb-3">✨</div>
                <h2 className="text-2xl font-bold text-purple-900 mb-2">Save your fart!</h2>
                <p className="text-gray-600 mb-3 text-sm">
                  Duration: {pendingRecording.duration.toFixed(1)}s
                </p>
                <input
                  type="text"
                  value={newRecName}
                  onChange={(e) => setNewRecName(e.target.value)}
                  placeholder="Name it!"
                  className="w-full px-4 py-3 rounded-xl border-2 border-purple-300 text-center font-bold text-lg mb-3"
                  maxLength={20}
                />
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Pick an emoji:</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {EMOJI_CHOICES.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNewRecEmoji(e)}
                        className={`text-2xl p-1.5 rounded-lg ${newRecEmoji === e ? "bg-purple-200 ring-2 ring-purple-500" : "bg-gray-100"}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      URL.revokeObjectURL(pendingRecording.url);
                      setPendingRecording(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                  >
                    Discard
                  </button>
                  <button
                    onClick={onSaveRecording}
                    className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold active:scale-95"
                  >
                    💾 Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Poof particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {poofs.map((p) => (
          <div key={p.id} className="absolute text-4xl animate-poof" style={{ left: p.x - 20, top: p.y - 20 }}>
            {p.emoji}
          </div>
        ))}
      </div>
    </div>
  );
}
