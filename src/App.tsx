import { useState, useCallback, useEffect, useRef } from "react";
import { useTap } from "./hooks/useTap";
import {
  PRESETS,
  playFart,
  primeAudio,
  startRecording,
  stopRecording,
  loadRecordings,
  saveRecording,
  deleteRecording,
  setPitchSemitones,
  setSpeedFactor,
  setReverbAmount as setReverbAmountEngine,
  stopAllSounds,
  playBlobWithFx,
  type FartPreset,
  type CustomRecording,
} from "./audio/fartEngine";
import {
  uploadCustomRecording,
} from "./audio/serverApi";
import {
  loadProfiles,
  createKid,
  getActiveKidId,
  setActiveKidId,
  deleteKid,
  updateStats,
  getComboName,
  loadParentalSettings,
  saveParentalSettings,
  isPlayTimeAllowed,
  getTodayRecordingsCount,
  incrementTodayRecordings,
  getAvatarChoices,
  type Kid,
  type ParentalSettings,
} from "./game/state";
import { PinGate } from "./game/PinGate";

const EMOJI_RAIN = ["💨", "💥", "🌪️", "💦", "🌀", "✨"];

// === AnimalCard — single tap-to-fart cell, scroll-safe. ===
type AnimalCardProps = {
  preset: FartPreset;
  active: boolean;
  onPlay: (p: FartPreset) => void;
};

function AnimalCard({ preset, active, onPlay }: AnimalCardProps) {
  const tap = useTap(() => onPlay(preset));
  return (
    <button
      {...tap}
      style={{ touchAction: "manipulation" }}
      className={`relative aspect-square rounded-3xl bg-gradient-to-br ${preset.color} shadow-xl border-4 border-white/70 active:scale-95 transition-transform select-none ${active ? "scale-95" : ""}`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none">
        <div className={`text-6xl sm:text-7xl ${active ? "animate-wiggle" : ""}`}>{preset.emoji}</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-amber-950 drop-shadow truncate max-w-full">{preset.name}</div>
      </div>
    </button>
  );
}

// === RecordingTile — appears in the same grid after the kid has made one. ===
function RecordingTile({ rec, onPlay, onDelete, onShare }: {
  rec: CustomRecording;
  onPlay: (rec: CustomRecording) => void;
  onDelete: (id: string) => void;
  onShare: (rec: CustomRecording) => void;
}) {
  const tap = useTap(() => onPlay(rec));
  return (
    <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 shadow-xl border-4 border-white">
      <button
        {...tap}
        style={{ touchAction: "manipulation" }}
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2 active:scale-95 transition-transform select-none"
      >
        <div className="text-6xl sm:text-7xl">{rec.emoji}</div>
        <div className="mt-1 text-base sm:text-lg font-bold text-purple-950 truncate max-w-full">{rec.name}</div>
      </button>
      <button
        onClick={() => onShare(rec)}
        aria-label="Share"
        className="absolute top-1 left-1 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        🔗
      </button>
      <button
        onClick={() => onDelete(rec.id)}
        aria-label="Delete"
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        ✕
      </button>
    </div>
  );
}

// === Effects sheet — the only place voice controls live. ===
function EffectsSheet({ open, onClose, audioMode, setAudioMode, speed, setSpeed, pitchShift, setPitchShift, reverbAmount, setReverbAmount }: {
  open: boolean;
  onClose: () => void;
  audioMode: "normal" | "chipmunk" | "slowmo";
  setAudioMode: (m: "normal" | "chipmunk" | "slowmo") => void;
  speed: number; setSpeed: (n: number) => void;
  pitchShift: number; setPitchShift: (n: number) => void;
  reverbAmount: number; setReverbAmount: (n: number) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-slate-800">🎚️ Make it weird</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-lg font-bold active:scale-95">✕</button>
        </div>
        <p className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Voice</p>
        <div className="flex gap-1.5 mb-4">
          {([
            { id: "normal" as const, label: "Normal", emoji: "🔊" },
            { id: "chipmunk" as const, label: "Chipmunk", emoji: "🐿️" },
            { id: "slowmo" as const, label: "Slow-Mo", emoji: "🐢" },
          ]).map((m) => (
            <button
              key={m.id}
              onClick={() => setAudioMode(m.id)}
              className={`flex-1 font-bold text-sm py-2.5 rounded-xl border-2 active:scale-95 ${audioMode === m.id ? "bg-amber-100 text-amber-900 border-amber-400" : "bg-white text-slate-600 border-slate-200"}`}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Tweak</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <label className="flex flex-col gap-1 bg-slate-50 rounded-xl p-2.5">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>🎵 Speed</span><span>{speed.toFixed(1)}x</span>
            </div>
            <input type="range" min="0.5" max="1.5" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 bg-slate-50 rounded-xl p-2.5">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>🎚️ Pitch</span><span>{pitchShift > 0 ? "+" : ""}{pitchShift}</span>
            </div>
            <input type="range" min="-12" max="12" step="1" value={pitchShift} onChange={(e) => setPitchShift(parseInt(e.target.value))} />
          </label>
        </div>
        <p className="text-xs font-bold text-slate-500 mb-1.5 uppercase">Room</p>
        <div className="flex gap-1.5">
          {([
            { id: 0, label: "Dry", emoji: "🔈" },
            { id: 1, label: "Bathroom", emoji: "🚿" },
            { id: 2, label: "Cave", emoji: "🦇" },
          ] as const).map((r) => (
            <button
              key={r.id}
              onClick={() => setReverbAmount(r.id)}
              className={`flex-1 font-bold text-sm py-2.5 rounded-xl border-2 active:scale-95 ${reverbAmount === r.id ? (r.id === 0 ? "bg-white text-slate-700 border-slate-400" : r.id === 1 ? "bg-cyan-100 text-cyan-900 border-cyan-400" : "bg-indigo-100 text-indigo-900 border-indigo-400") : "bg-white text-slate-400 border-slate-200"}`}
            >
              {r.emoji} {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// === AddCodeModal — paste a 4-character code to grab a friend's sound. ===
function AddCodeModal({ onClose, onAdd, busy, error }: { onClose: () => void; onAdd: (code: string) => void; busy: boolean; error: string | null }) {
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">🔗 Got a code?</h2>
        <p className="text-sm text-slate-600 text-center mb-4">Type the 4 letters or numbers your friend read to you.</p>
        <input
          ref={ref}
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
          onKeyDown={(e) => { if (e.key === "Enter" && code.length === 4) onAdd(code); }}
          placeholder="ABCD"
          maxLength={4}
          className="w-full text-center font-mono font-bold text-4xl tracking-[0.5em] px-4 py-5 rounded-2xl border-4 border-emerald-200 focus:border-emerald-500 focus:outline-none mb-3"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        {error && <div className="bg-red-100 border-2 border-red-300 text-red-800 rounded-xl p-2 mb-3 text-sm text-center">{error}</div>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold">Cancel</button>
          <button onClick={() => onAdd(code)} disabled={busy || code.length !== 4} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95 disabled:opacity-50">
            {busy ? "…" : "Get sound"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === ParentalTab — the only place parents go. Quiet hours, daily limit, etc. ===
function ParentalTab({ parental, setParental, showHypeMeter, setShowHypeMeter }: {
  parental: ParentalSettings;
  setParental: (s: ParentalSettings) => void;
  showHypeMeter: boolean;
  setShowHypeMeter: (v: boolean) => void;
}) {
  const [local, setLocal] = useState(parental);
  const update = <K extends keyof ParentalSettings>(key: K, value: ParentalSettings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    setParental(next);
  };
  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">👪 Grown-Up Settings</h2>
      <p className="text-sm text-slate-700/70 text-center mb-4">Quiet hours, daily limits, and more.</p>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-bold text-slate-800">🌙 Quiet hours</div>
            <div className="text-xs text-slate-600">App greys out outside the play window</div>
          </div>
          <input type="checkbox" checked={local.enabled} onChange={(e) => update("enabled", e.target.checked)} className="w-6 h-6" />
        </label>
        {local.enabled && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 mb-1">Start</span>
              <input type="number" min={0} max={23} value={local.startHour} onChange={(e) => update("startHour", parseInt(e.target.value))} className="px-2 py-1 rounded border" />
            </label>
            <label className="flex flex-col">
              <span className="text-xs text-slate-600 mb-1">End</span>
              <input type="number" min={0} max={23} value={local.endHour} onChange={(e) => update("endHour", parseInt(e.target.value))} className="px-2 py-1 rounded border" />
            </label>
          </div>
        )}
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={showHypeMeter} onChange={(e) => setShowHypeMeter(e.target.checked)} className="w-6 h-6 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-slate-800">💨 Show hype meter</div>
            <div className="text-xs text-slate-600 mt-1">A small progress bar in the corner that fills as the kid taps.</div>
          </div>
        </label>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <button onClick={() => { stopAllSounds(); }} className="w-full py-3 rounded-xl bg-red-500 text-white font-bold active:scale-95">
          🛑 Stop All Sounds
        </button>
        <p className="text-xs text-slate-600 mt-2 text-center">Kills any audio currently playing</p>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-sm text-red-900">
        <h3 className="font-bold mb-2">📍 All data is stored on this device only</h3>
        <p>Recordings and stats live in your browser's local storage. No data is sent to any server. Clearing your browser data will erase all recordings.</p>
      </div>
    </main>
  );
}

// === Top-level App ===
export default function App() {
  // === Core state (kept minimal) ===
  const [activeKid, setActiveKidState] = useState<Kid | null>(null);
  const [profiles, setProfiles] = useState<Kid[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [parental, setParental] = useState<ParentalSettings>(loadParentalSettings());
  const [parentalBlocked, setParentalBlocked] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const [parentalTabOpen, setParentalTabOpen] = useState(false);

  const [recordings, setRecordings] = useState<CustomRecording[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [showHypeMeter, setShowHypeMeter] = useState(false);
  // Hype is a ref because it's read inside `trigger` but never needs to
  // re-render the grid. Emoji rain is the visible side-effect.
  const [, setHypeLevel] = useState(0);
  const hypeRef = useRef(0);
  const [reverbAmount, setReverbAmount] = useState(0);
  const [audioMode, setAudioMode] = useState<"normal" | "chipmunk" | "slowmo">("normal");
  const [pitchShift, setPitchShift] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number; blob: Blob } | null>(null);

  const [showEffectsSheet, setShowEffectsSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState<{ code: string; name: string; emoji: string; success?: boolean } | null>(null);
  const [showAddCode, setShowAddCode] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const [comboPopup, setComboPopup] = useState<string | null>(null);
  const [emojiRainActive, setEmojiRainActive] = useState(false);

  const lastActionRef = useRef<{ random: number; combo: number }>({ random: 0, combo: 0 });
  const recordTimerRef = useRef<number | null>(null);
  // Recent taps are kept in a ref so the trigger callback doesn't recreate
  // every render. Only `comboPopup` is reactive (a UI concern).
  const recentTapsRef = useRef<{ id: string; time: number }[]>([]);

  // Load profiles + recordings on mount
  useEffect(() => {
    const p = loadProfiles();
    setProfiles(p);
    if (p.length === 0) {
      setShowProfileModal(true);
    } else {
      const activeId = getActiveKidId();
      const kid = activeId ? p.find((k) => k.id === activeId) || p[0] : p[0];
      setActiveKidState(kid);
      setActiveKidId(kid.id);
    }
    setRecordings(loadRecordings());
  }, []);

  // Re-load recordings on the cross-tab event
  useEffect(() => {
    const onMyFartsChanged = () => setRecordings(loadRecordings());
    window.addEventListener("animal-farts:my-farts-changed", onMyFartsChanged);
    return () => window.removeEventListener("animal-farts:my-farts-changed", onMyFartsChanged);
  }, []);

  // (v25: installable + iOS install nudge removed. The browser's own
  // "Add to Home Screen" affordance is enough; the in-app banner was
  // competing with the kid's grid for attention.)

  // Check quiet-hours block
  useEffect(() => {
    const check = () => setParentalBlocked(!isPlayTimeAllowed(parental));
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [parental]);

  // Audio engine state syncs
  useEffect(() => { setPitchSemitones(pitchShift); }, [pitchShift]);
  useEffect(() => { setSpeedFactor(speed); }, [speed]);
  useEffect(() => { setReverbAmountEngine(reverbAmount); }, [reverbAmount]);

  // (v25: poof particles removed. Hype meter + emoji rain cover the
  // visual feedback need; per-tap poofs were visual noise that hid the grid.)

  // Record timer
  useEffect(() => {
    if (recording) {
      setRecordDuration(0);
      recordTimerRef.current = window.setInterval(() => setRecordDuration((d) => d + 0.1), 100);
    } else if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    return () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); };
  }, [recording]);

  // (v25: removed toggleReverb + reverbMode — was only used inside ParentalTab
  // for a "bathroom echo by default" toggle that was overkill. Effects
  // sheet still exposes reverb as a per-sound choice.)

  // Tap an animal
  const trigger = useCallback((preset: FartPreset) => {
    primeAudio();
    playFart(preset);
    setActive(preset.id);
    setTimeout(() => setActive((cur) => (cur === preset.id ? null : cur)), 250);

    // Combo detection: 3+ taps within 3 seconds = combo
    const now = Date.now();
    const recent = [...recentTapsRef.current, { id: preset.id, time: now }].filter((t) => now - t.time < 3000);
    recentTapsRef.current = recent;
    if (recent.length >= 3) {
      const combo = getComboName(recent.map((t) => t.id));
      if (combo) {
        setComboPopup(combo);
        setTimeout(() => setComboPopup(null), 2500);
        if (activeKid) {
          updateStats(activeKid.id, (s) => ({ ...s, combosPlayed: s.combosPlayed + 1 }));
        }
      }
    }

    // Hype: every tap bumps the level; level 5 = emoji rain
    const next = Math.min(5, hypeRef.current + 1);
    hypeRef.current = next;
    setHypeLevel(next);
    if (next === 5) {
      setEmojiRainActive(true);
      setTimeout(() => setEmojiRainActive(false), 3000);
    }
  }, [activeKid]);

  const onRandom = useCallback(() => {
    if (Date.now() - lastActionRef.current.random < 400) return;
    lastActionRef.current.random = Date.now();
    const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    trigger(p);
  }, [trigger]);

  const onCombo = useCallback(() => {
    if (Date.now() - lastActionRef.current.combo < 600) return;
    lastActionRef.current.combo = Date.now();
    primeAudio();
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
        playFart(p);
        setActive(p.id);
        setTimeout(() => setActive((cur) => (cur === p.id ? null : cur)), 250);
      }, i * 120);
    }
  }, []);

  const onStartRecord = useCallback(async () => {
    if (parentalBlocked) return;
    const limit = parental.dailyRecordingLimit;
    if (limit > 0 && getTodayRecordingsCount() >= limit) {
      console.warn("Daily recording limit reached");
      return;
    }
    try {
      await startRecording();
      setRecording(true);
    } catch (err: any) {
      console.warn("Microphone access failed:", err?.message || err);
    }
  }, [parental]);

  const onStopRecord = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    const result = await stopRecording();
    if (result && result.duration > 0.2) {
      // Auto-save: kid makes a sound, it's in their library
      const name = `My sound ${recordings.length + 1}`;
      const emoji = "💨";
      const rec = saveRecording({ name, emoji, url: result.url, visibility: "local" });
      setRecordings([...recordings, rec]);
      if (activeKid) {
        incrementTodayRecordings();
        updateStats(activeKid.id, (s) => ({
          ...s,
          recordings: s.recordings + 1,
          longestRecordingSec: Math.max(s.longestRecordingSec, result.duration),
        }));
      }
      setPendingRecording({ url: result.url, duration: result.duration, blob: result.blob });
    }
  }, [recording, recordings, activeKid]);

  const onDeleteRecording = useCallback((id: string) => {
    if (!confirm("Delete this sound?")) return;
    deleteRecording(id);
    setRecordings((cur) => cur.filter((r) => r.id !== id));
  }, []);

  const onPlayCustom = useCallback(async (rec: CustomRecording) => {
    primeAudio();
    try {
      const resp = await fetch(rec.url);
      const blob = await resp.blob();
      await playBlobWithFx(blob, (window as any).__reverbAmount ?? 0);
    } catch {
      const audio = new Audio(rec.url);
      audio.volume = 0.9;
      audio.play().catch(() => {});
    }
    setHypeLevel((h) => Math.min(5, h + 1));
  }, []);

  const onShareRecording = useCallback(async (rec: CustomRecording) => {
    try {
      let audioUrl = (rec as any).serverAudioUrl as string | undefined;
      if (!audioUrl) {
        const shared = await uploadCustomRecording(rec, activeKid?.name);
        audioUrl = shared.audioUrl;
      }
      const { mintShareCode } = await import("./audio/serverApi");
      const result = await mintShareCode({ audioUrl, name: rec.name, emoji: rec.emoji });
      setShowShareModal({ code: result.code, name: rec.name, emoji: rec.emoji });
    } catch {
      setShowShareModal({ code: "----", name: rec.name, emoji: rec.emoji, success: false });
    }
  }, [activeKid]);

  const onAddByCode = useCallback(async (rawCode: string) => {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (code.length !== 4) {
      setShareError("Codes are 4 letters or numbers.");
      return;
    }
    setShareBusy(true);
    setShareError(null);
    try {
      const { lookupShareCode } = await import("./audio/serverApi");
      const result = await lookupShareCode(code);
      const resp = await fetch(result.audioUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const saved = saveRecording({ name: result.name, emoji: result.emoji, url, visibility: "local" });
      setRecordings((cur) => [...cur, saved]);
      setShowAddCode(false);
      setShowShareModal({ code, name: result.name, emoji: result.emoji, success: true });
    } catch {
      setShareError("Couldn't find that code. Check the letters and try again.");
    } finally {
      setShareBusy(false);
    }
  }, []);

  // === RENDER ===
  // Three modes:
  //   1. parentalTabOpen  -> ParentalTab full screen
  //   2. parentalBlocked  -> "Come back later" screen
  //   3. default           -> the kid's grid
  if (parentalTabOpen) {
    return (
      <ParentalTab
        parental={parental}
        setParental={(s) => { saveParentalSettings(s); setParental(s); }}
        showHypeMeter={showHypeMeter}
        setShowHypeMeter={setShowHypeMeter}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* (v25: iOS install nudge removed.) */}

      {/* Header — one line, no clutter. Profile + settings as small icons. */}
      <header className="px-3 pt-3 pb-2 flex items-center justify-between max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900">💨 Animal Farts</h1>
        <div className="flex items-center gap-2">
          {activeKid && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-3 py-1.5 rounded-full bg-white/80 border-2 border-purple-200 text-sm font-bold text-purple-900 active:scale-95 flex items-center gap-1"
            >
              <span>{activeKid.avatar}</span>
              <span>{activeKid.name}</span>
            </button>
          )}
          <button
            onClick={() => setPinGateOpen(true)}
            aria-label="Parents"
            title="Parents"
            className="w-9 h-9 rounded-full bg-white/70 text-slate-500 border border-slate-200 text-base active:scale-95 flex items-center justify-center"
          >
            👪
          </button>
        </div>
      </header>

      {/* The kid's screen: animals + their recordings, all in one grid. */}
      <main className="flex-1 px-3 pb-40 max-w-3xl mx-auto w-full">
        {parentalBlocked ? (
          <div className="bg-slate-700 text-white rounded-3xl p-6 text-center mt-4">
            <div className="text-5xl mb-3">🌙</div>
            <h2 className="text-2xl font-bold mb-1">Quiet time</h2>
            <p className="text-sm">Come back during play hours. Ask a parent to change settings.</p>
          </div>
        ) : (
          <>
            {/* Recordings appear first if there are any, then the animals. */}
            {recordings.length > 0 && (
              <h2 className="text-base font-bold text-purple-900 mt-2 mb-2 text-center">🎤 My sounds</h2>
            )}
            {recordings.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {recordings.map((rec) => (
                  <RecordingTile key={rec.id} rec={rec} onPlay={onPlayCustom} onDelete={onDeleteRecording} onShare={onShareRecording} />
                ))}
                <button
                  onClick={() => setShowAddCode(true)}
                  className="aspect-square rounded-3xl bg-white/50 border-4 border-dashed border-emerald-300 text-emerald-700 active:scale-95 transition-transform flex flex-col items-center justify-center"
                  title="Add a friend's sound"
                >
                  <div className="text-3xl">🔗</div>
                  <div className="text-xs font-bold mt-1">Add code</div>
                </button>
              </div>
            )}

            <h2 className="text-base font-bold text-amber-900 mt-2 mb-2 text-center">🐾 Animals</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRESETS.map((p) => (
                <AnimalCard key={p.id} preset={p} active={active === p.id} onPlay={trigger} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Bottom action bar: record + surprise + combo + effects. Recording is
          THE primary action for a kid who wants their own sound. */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button
            onClick={recording ? onStopRecord : onStartRecord}
            className={`flex-1 font-extrabold text-base py-4 rounded-2xl shadow-lg border-2 border-white active:scale-95 ${recording ? "bg-red-500 text-white" : "bg-gradient-to-br from-pink-500 to-purple-500 text-white"}`}
          >
            {recording ? `⏹  Stop (${recordDuration.toFixed(1)}s)` : "🎤  Make a sound"}
          </button>
          <button
            onClick={onRandom}
            className="w-12 h-12 rounded-2xl bg-white border-2 border-amber-200 text-2xl active:scale-95 flex items-center justify-center shadow"
            title="Surprise me"
            aria-label="Surprise me"
          >
            🎲
          </button>
          <button
            onClick={onCombo}
            className="w-12 h-12 rounded-2xl bg-white border-2 border-orange-200 text-2xl active:scale-95 flex items-center justify-center shadow"
            title="Combo"
            aria-label="Combo"
          >
            💥
          </button>
          <button
            onClick={() => setShowEffectsSheet(true)}
            className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-200 text-2xl active:scale-95 flex items-center justify-center shadow"
            title="Effects"
            aria-label="Effects"
          >
            🎚️
          </button>
        </div>
      </footer>

      {/* === Modals and overlays === */}

      {/* Saved confirmation after recording */}
      {pendingRecording && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPendingRecording(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl mb-3">✨</div>
            <h2 className="text-2xl font-bold text-purple-900 mb-1">Saved!</h2>
            <p className="text-gray-600 mb-4 text-sm">"{recordings[recordings.length - 1]?.name || "Your sound"}" is up top.</p>
            <button onClick={() => setPendingRecording(null)} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95">✓ OK</button>
          </div>
        </div>
      )}

      {/* Share code display */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowShareModal(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            {showShareModal.success ? (
              <>
                <div className="text-6xl mb-2">{showShareModal.emoji}</div>
                <h2 className="text-2xl font-bold text-emerald-900 mb-1">Got it!</h2>
                <p className="text-sm text-slate-600 mb-4">"{showShareModal.name}" is now in your library.</p>
                <button onClick={() => setShowShareModal(null)} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95">OK</button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">🔗</div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Your code</h2>
                <p className="text-sm text-slate-600 mb-4">Read this to your friend. They tap 🔗 and type it in.</p>
                <div className="font-mono font-bold text-5xl tracking-[0.5em] text-emerald-700 bg-emerald-50 rounded-2xl py-6 mb-4 select-all">
                  {showShareModal.code}
                </div>
                <button onClick={() => setShowShareModal(null)} className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold active:scale-95">Done</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add-by-code entry */}
      {showAddCode && (
        <AddCodeModal
          onClose={() => setShowAddCode(false)}
          onAdd={onAddByCode}
          busy={shareBusy}
          error={shareError}
        />
      )}

      {/* Effects sheet */}
      <EffectsSheet
        open={showEffectsSheet}
        onClose={() => setShowEffectsSheet(false)}
        audioMode={audioMode}
        setAudioMode={setAudioMode}
        speed={speed}
        setSpeed={setSpeed}
        pitchShift={pitchShift}
        setPitchShift={setPitchShift}
        reverbAmount={reverbAmount}
        setReverbAmount={setReverbAmount}
      />

      {/* Parents gate */}
      <PinGate
        open={pinGateOpen}
        onClose={() => setPinGateOpen(false)}
        onSuccess={() => { setPinGateOpen(false); setParentalTabOpen(true); }}
        title="Parent PIN"
      >
        {() => null}
      </PinGate>

      {/* Profile modal — also where you add a kid */}
      {showProfileModal && (
        <ProfileModal
          profiles={profiles}
          setProfiles={setProfiles}
          activeKid={activeKid}
          setActiveKid={(k) => { setActiveKidState(k); setActiveKidId(k.id); setShowProfileModal(false); }}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Combo popup */}
      {comboPopup && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-lg pointer-events-none animate-bounce">
          🎉 {comboPopup}!
        </div>
      )}

      {/* Emoji rain when hype peaks */}
      {emojiRainActive && (
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-bounce"
              style={{
                left: `${(i * 13) % 100}%`,
                top: `-${(i * 7) % 20}px`,
                animationDelay: `${(i * 0.1) % 2}s`,
                animationDuration: `${2 + (i % 3)}s`,
              }}
            >
              {EMOJI_RAIN[i % EMOJI_RAIN.length]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === ProfileModal — manage who is playing. Lightweight, no editing. ===
function ProfileModal({ profiles, activeKid, setActiveKid, onClose, setProfiles }: {
  profiles: Kid[];
  activeKid: Kid | null;
  setActiveKid: (k: Kid) => void;
  onClose: () => void;
  setProfiles: (p: Kid[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🐱");
  const avatars = getAvatarChoices();

  const onAdd = () => {
    if (!newName.trim()) return;
    const choice = avatars.find((a) => a.emoji === newAvatar) || avatars[0];
    const kid = createKid(newName.trim(), choice.emoji, choice.color);
    setProfiles([...profiles, kid]);
    setActiveKid(kid);
    setNewName("");
  };

  const onDelete = (id: string) => {
    if (!confirm("Delete this kid? Their recordings stay on this device.")) return;
    deleteKid(id);
    const remaining = loadProfiles();
    setProfiles(remaining);
    if (remaining.length > 0) setActiveKid(remaining[0]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-purple-900">👤 Who's playing?</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 text-lg font-bold active:scale-95">✕</button>
        </div>
        {profiles.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {profiles.map((k) => (
              <button
                key={k.id}
                onClick={() => setActiveKid(k)}
                className={`p-3 rounded-2xl border-2 text-center active:scale-95 ${activeKid?.id === k.id ? "bg-purple-100 border-purple-400" : "bg-white border-slate-200"}`}
              >
                <div className="text-3xl">{k.avatar}</div>
                <div className="font-bold text-purple-900 text-sm mt-1 truncate">{k.name}</div>
              </button>
            ))}
          </div>
        )}
        <div className="bg-slate-50 rounded-2xl p-3">
          <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Add a kid</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 mb-2"
            maxLength={20}
          />
          <div className="flex flex-wrap gap-1 mb-3">
            {avatars.map((a) => (
              <button
                key={a.emoji}
                onClick={() => setNewAvatar(a.emoji)}
                className={`text-xl p-1.5 rounded-lg ${newAvatar === a.emoji ? "bg-purple-200 ring-2 ring-purple-500" : "bg-white"}`}
              >
                {a.emoji}
              </button>
            ))}
          </div>
          <button onClick={onAdd} disabled={!newName.trim()} className="w-full py-2.5 rounded-xl bg-purple-500 text-white font-bold active:scale-95 disabled:opacity-50">
            + Add
          </button>
        </div>
        {activeKid && profiles.length > 1 && (
          <button
            onClick={() => onDelete(activeKid.id)}
            className="w-full mt-3 py-2 text-sm text-red-500 font-bold"
          >
            Remove {activeKid.name}
          </button>
        )}
      </div>
    </div>
  );
}
