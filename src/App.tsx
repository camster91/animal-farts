import { useState, useCallback, useEffect, useRef } from "react";
import {
  isInstallAvailable,
  isIosSafari,
  isInstalledPwa,
  parseLaunchAction,
  promptInstall,
  share,
  watchOnlineStatus,
  type LaunchAction,
} from "./pwa";
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
  setReverbMode,
  setReverbAmount,
  setPitchSemitones,
  setSpeedFactor,
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
  getStats,
  updateStats,
  trackAnimalTried,
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
// (Adult mode removed in v23 — replaced by a dedicated Parents page.
import { PinGate } from "./game/PinGate";

type Poof = { id: number; x: number; y: number; emoji: string };
type Tab = "play" | "explore" | "mystuff" | "parental";

const HYPE_LABELS = [
  "Calm wind", "Whisper toot", "Solid rip", "HILARIOUS rip",
  "ROOM-CLEARER", "EVACUATE THE PREMISES",
];
const EMOJI_RAIN = ["💨", "💥", "🌪️", "💦", "🌀", "✨"];

// AnimalCard — single tap-to-fart cell, with scroll-safe tap detection.
// On iOS Safari, a finger that lands on a button can also be the start of
// a scroll. `useTap` only fires the callback when the pointer stays within
// a small movement budget AND a short time window.
type AnimalCardProps = {
  preset: FartPreset;
  active: boolean;
  onPlay: (p: FartPreset, e?: React.MouseEvent | React.TouchEvent | React.PointerEvent) => void;
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
        <div className={`text-5xl sm:text-6xl ${active ? "animate-wiggle" : ""}`}>{preset.emoji}</div>
        <div className="mt-1 text-sm sm:text-base font-bold text-amber-950 drop-shadow truncate max-w-full">{preset.name}</div>
        <div className="text-[9px] sm:text-[10px] font-semibold text-amber-900/80 uppercase tracking-wider truncate max-w-full">{preset.caption}</div>
      </div>
    </button>
  );
}

function RecordingTile({ rec, onPlay, onDelete, onShare }: { rec: CustomRecording; onPlay: (rec: CustomRecording) => void; onDelete: (id: string) => void; onShare: (rec: CustomRecording) => void }) {
  const tap = useTap(() => onPlay(rec));
  return (
    <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 shadow-xl border-4 border-white">
      <button
        {...tap}
        style={{ touchAction: "manipulation" }}
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2 active:scale-95 transition-transform select-none"
      >
        <div className="text-5xl sm:text-6xl">{rec.emoji}</div>
        <div className="mt-1 text-sm sm:text-base font-bold text-purple-950 truncate max-w-full">{rec.name}</div>
        <div className="text-[10px] font-semibold text-purple-900/80">{rec.id.toUpperCase()}</div>
      </button>
      <button
        onClick={() => onShare(rec)}
        aria-label="Share"
        title="Share with a code"
        className="absolute top-1 left-1 w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        🔗
      </button>
      <button
        onClick={() => onDelete(rec.id)}
        aria-label="Delete"
        title="Delete"
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        ✕
      </button>
    </div>
  );
}

// AddCodeModal — paste a 4-character share code to grab a sound a friend
// shared with you. Single big text input, instant feedback, no signup.
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
          <button
            onClick={() => onAdd(code)}
            disabled={busy || code.length !== 4}
            className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95 disabled:opacity-50"
          >
            {busy ? "…" : "Get sound"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("play");
  const [profiles, setProfiles] = useState<Kid[]>([]);
  const [activeKid, setActiveKidState] = useState<Kid | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showKidMenu, setShowKidMenu] = useState(false);
  // PWA state
  const [installable, setInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [showShareToast, setShowShareToast] = useState<"shared" | "copied" | "unsupported" | null>(null);
  const [launchAction, setLaunchAction] = useState<LaunchAction>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // (Social state removed in v23 — replaced with 4-character code sharing.)

  // PWA setup: install prompt, online status, launch action, SW updates
  useEffect(() => {
    const onInstallable = () => setInstallable(true);
    const onInstalled = () => { setInstallable(false); setShowIosInstall(false); };
    window.addEventListener("pwa-installable", onInstallable);
    window.addEventListener("pwa-installed", onInstalled);
    setInstallable(isInstallAvailable());
    // iOS Safari: always show install instructions unless already installed
    if (isIosSafari() && !isInstalledPwa()) {
      setShowIosInstall(true);
    }
    // Online status
    const stopWatching = watchOnlineStatus(setIsOnline);
    // Launch action from PWA shortcut
    const action = parseLaunchAction();
    if (action) {
      setLaunchAction(action);
      // Clean the URL so a refresh doesn't re-trigger
      window.history.replaceState({}, "", window.location.pathname);
    }
    // SW update detection
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      });
    }
    return () => {
      window.removeEventListener("pwa-installable", onInstallable);
      window.removeEventListener("pwa-installed", onInstalled);
      stopWatching();
    };
  }, []);

  // Apply launch action when activeKid becomes available
  useEffect(() => {
    if (!launchAction) return;
    if (launchAction.type === "surprise") {
      onRandomRef.current?.();
    } else if (launchAction.type === "challenge") {
      setTab("mystuff"); // daily challenge lives inside My Stuff
    } else if (launchAction.type === "record") {
      setShowRecordModal(true);
    }
    setLaunchAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchAction, activeKid]);

  // Refresh app when user taps "Update"
  const applyUpdate = useCallback(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }
      });
    }
  }, []);
  const [poofs, setPoofs] = useState<Poof[]>([]);
  const [shake, setShake] = useState(false);
  const [hype, setHype] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<CustomRecording[]>([]);
  const [reverbMode, setReverbModeState] = useState(false);
  const [reverbAmount, setReverbAmountState] = useState(0); // 0=none, 1=bathroom, 2=cave
  const [audioMode, setAudioMode] = useState<"normal" | "chipmunk" | "slowmo">("normal");
  const [pitchShift, setPitchShift] = useState(0); // semitones
  const [speed, setSpeed] = useState(1.0); // playback rate

  // Sync the engine's mode state with the UI
  useEffect(() => {
    setReverbAmount(reverbAmount);
    // chipmunk = high pitch + fast, slowmo = low pitch + slow
    if (audioMode === "chipmunk") {
      setSpeedFactor(1.6);
      setPitchSemitones(7);
    } else if (audioMode === "slowmo") {
      setSpeedFactor(0.5);
      setPitchSemitones(-7);
    } else {
      setSpeedFactor(speed);
      setPitchSemitones(pitchShift);
    }
  }, [reverbAmount, audioMode, pitchShift, speed]);

  // When audio mode changes, force speed/pitch sliders back to neutral
  useEffect(() => {
    if (audioMode === "chipmunk" || audioMode === "slowmo") {
      setPitchShift(0);
      setSpeed(1.0);
    }
  }, [audioMode]);
  const [showHypeMeter, setShowHypeMeter] = useState(false); // off by default — less noise for kids
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number; blob: Blob } | null>(null);
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmoji, setNewRecEmoji] = useState("💨");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [parental, setParental] = useState<ParentalSettings>(loadParentalSettings());
  // Parents page is opened from the gear icon. PinGate protects it.
  const [pinGateOpen, setPinGateOpen] = useState(false);

  // Share-code modals
  const [shareModal, setShareModal] = useState<{ code: string; name: string; emoji: string; success?: boolean } | null>(null);
  const [addCodeOpen, setAddCodeOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [emojiRainActive, setEmojiRainActive] = useState(false);
  const [petState, setPetState] = useState<"happy" | "covering" | "dancing" | "shocked">("happy");
  const [recentTaps, setRecentTaps] = useState<{ id: string; time: number }[]>([]);
  // Suppress TS6133 for recentTaps when it isn't read directly; it triggers re-renders for combo popups
  const _recentTapsRef = recentTaps; void _recentTapsRef;
  const [comboPopup, setComboPopup] = useState<string | null>(null);
  // (v23: achievementPopup removed.)
  const [parentalBlocked, setParentalBlocked] = useState(false);

  const lastTriggerRef = useRef<{ [k: string]: number }>({});
  const lastActionRef = useRef<{ random: number; combo: number }>({ random: 0, combo: 0 });
  const recordTimerRef = useRef<number | null>(null);
  const petTimerRef = useRef<number | null>(null);

  // Load profiles on mount
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

  // React to feed recordings being copied into "My Farts" (from any tab)
  useEffect(() => {
    const onMyFartsChanged = () => setRecordings(loadRecordings());
    window.addEventListener("animal-farts:my-farts-changed", onMyFartsChanged);
    return () => window.removeEventListener("animal-farts:my-farts-changed", onMyFartsChanged);
  }, []);

  // Check parental time-of-day
  useEffect(() => {
    const check = () => setParentalBlocked(!isPlayTimeAllowed(parental));
    check();
    const t = setInterval(check, 60000); // every minute
    return () => clearInterval(t);
  }, [parental]);

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

  // Pet reaction cycle
  useEffect(() => {
    if (petTimerRef.current) clearTimeout(petTimerRef.current);
    if (petState !== "happy") {
      petTimerRef.current = window.setTimeout(() => setPetState("happy"), 2000);
    }
    return () => {
      if (petTimerRef.current) clearTimeout(petTimerRef.current);
    };
  }, [petState]);

  // Close kid menu when clicking outside or switching tabs
  useEffect(() => {
    if (!showKidMenu) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-kid-menu-root]")) setShowKidMenu(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [showKidMenu]);
  useEffect(() => { setShowKidMenu(false); }, [tab]);

  // (v23: achievements removed. They were never opened by kids.)

  // Combo detection: 3+ taps within 3 seconds = combo
  const recordTapForCombo = useCallback((animalId: string) => {
    const now = Date.now();
    setRecentTaps((prev) => {
      const recent = [...prev, { id: animalId, time: now }].filter((t) => now - t.time < 3000);
      if (recent.length >= 3) {
        const combo = getComboName(recent.map((t) => t.id));
        setComboPopup(combo);
        setTimeout(() => setComboPopup(null), 2500);
        if (activeKid) {
          updateStats(activeKid.id, (s) => ({ ...s, combosPlayed: s.combosPlayed + 1 }));
        }
        return []; // reset
      }
      return recent;
    });
  }, [activeKid]);

  const trigger = useCallback((preset: FartPreset, e?: React.MouseEvent | React.TouchEvent) => {
    if (parentalBlocked) return;
    if (parental.mute && preset.id !== "stop") return;

    const now = Date.now();
    if (lastTriggerRef.current[preset.id] && now - lastTriggerRef.current[preset.id] < 300) {
      return;
    }
    lastTriggerRef.current[preset.id] = now;

    void primeAudio();

    try {
      playFart(preset, { loop: false });
    } catch (err) {
      console.warn("[fart] audio error:", err);
    }

    // Track stats
    if (activeKid) {
      trackAnimalTried(activeKid.id, preset.id);
      if (reverbMode) {
        updateStats(activeKid.id, (s) => ({ ...s, bathroomFarts: s.bathroomFarts + 1 }));
      }
      recordTapForCombo(preset.id);
    }

    // Pet reaction
    if (reverbMode) {
      setPetState("dancing");
    } else {
      setPetState("covering");
    }

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

    // Hype + emoji rain
    setHype((h) => {
      const newHype = Math.min(HYPE_LABELS.length - 1, h + 1);
      if (newHype === HYPE_LABELS.length - 1 && h < newHype) {
        setEmojiRainActive(true);
        setTimeout(() => setEmojiRainActive(false), 3000);
      }
      return newHype;
    });
  }, [activeKid, reverbMode, parentalBlocked, parental.mute, recordTapForCombo]);

  const onRandom = useCallback(() => {
    if (parentalBlocked) return;
    const now = Date.now();
    if (now - lastActionRef.current.random < 400) return;
    lastActionRef.current.random = now;
    trigger(PRESETS[Math.floor(Math.random() * PRESETS.length)]);
  }, [trigger, parentalBlocked]);
  const onRandomRef = useRef(onRandom);
  useEffect(() => { onRandomRef.current = onRandom; }, [onRandom]);

  const onCombo = useCallback(() => {
    if (parentalBlocked) return;
    const now = Date.now();
    if (now - lastActionRef.current.combo < 800) return;
    lastActionRef.current.combo = now;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      setTimeout(() => trigger(PRESETS[Math.floor(Math.random() * PRESETS.length)]), i * 220);
    }
  }, [trigger, parentalBlocked]);

  const toggleReverb = useCallback(() => {
    setReverbModeState((prev) => {
      const next = !prev;
      setReverbMode(next);
      return next;
    });
  }, []);

  const onStartRecord = useCallback(async () => {
    if (parentalBlocked) return;
    const limit = parental.dailyRecordingLimit;
    if (limit > 0 && getTodayRecordingsCount() >= limit) {
      setRecordError(`Daily limit reached (${limit} recordings). Ask a parent!`);
      return;
    }
    setRecordError(null);
    setRecordDuration(0);
    try {
      await startRecording();
      setRecording(true);
    } catch (err: any) {
      setRecordError(err?.message || "Could not access microphone.");
    }
  }, [parental]);

  const onStopRecord = useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    const result = await stopRecording();
    if (result && result.duration > 0.2) {
      // Auto-save immediately (v23: no decision modal for kids)
      const name = `My Fart ${recordings.length + 1}`;
      const emoji = "💨";
      const rec = saveRecording({
        name,
        emoji,
        url: result.url,
        visibility: "local",
      });
      setRecordings([...recordings, rec]);
      if (activeKid) {
        incrementTodayRecordings();
        updateStats(activeKid.id, (s) => ({
          ...s,
          recordings: s.recordings + 1,
          longestRecordingSec: Math.max(s.longestRecordingSec, result.duration),
        }));
      }
      // Show the "Saved!" confirmation with the auto-generated name
      setNewRecName(name);
      setNewRecEmoji(emoji);
      setPendingRecording({ url: result.url, duration: result.duration, blob: result.blob });
    }
  }, [recording, recordings, activeKid]);



  // Discard the recording. Frees the blob URL.
  const onDiscardPending = useCallback(() => {
    if (pendingRecording) {
      try { URL.revokeObjectURL(pendingRecording.url); } catch {}
    }
    setPendingRecording(null);
  }, [pendingRecording]);

  const onDeleteRecording = useCallback((id: string) => {
    if (!confirm("Delete this recording?")) return;
    deleteRecording(id);
    setRecordings(recordings.filter((r) => r.id !== id));
  }, [recordings]);

  // Share via 4-character code. The recording must live on the server
  // already (we upload it the first time share is tapped, then keep the
  // audioUrl for future shares).
  const onShareRecording = useCallback(async (rec: CustomRecording) => {
    try {
      // Reuse an existing server upload if we have one
      let audioUrl = (rec as any).serverAudioUrl as string | undefined;
      if (!audioUrl) {
        const shared = await uploadCustomRecording(rec, activeKid?.name);
        audioUrl = shared.audioUrl;
        // Persist the audioUrl on the local row for next time
        const next = recordings.map((r) => r.id === rec.id ? { ...r, serverAudioUrl: audioUrl } as any : r);
        try { localStorage.setItem("fart-custom-recordings", JSON.stringify(next)); } catch {}
        setRecordings(next as any);
      }
      const { mintShareCode } = await import("./audio/serverApi");
      const result = await mintShareCode({ audioUrl, name: rec.name, emoji: rec.emoji });
      setShareModal({ code: result.code, name: rec.name, emoji: rec.emoji });
    } catch (err) {
      alert("Couldn't make a share code right now. Try again when you're online.");
    }
  }, [recordings, activeKid]);

  // Look up a 4-character code and add the sound to the local library.
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
      // Fetch the audio as a blob, save locally
      const resp = await fetch(result.audioUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const saved = saveRecording({ name: result.name, emoji: result.emoji, url, visibility: "local" });
      setRecordings([...recordings, saved]);
      setShareError(null);
      setAddCodeOpen(false);
      setShareModal({ code, name: result.name, emoji: result.emoji, success: true });
    } catch (err) {
      setShareError("Couldn't find that code. Check the letters and try again.");
    } finally {
      setShareBusy(false);
    }
  }, [recordings]);

  const onPlayCustom = useCallback(async (rec: CustomRecording) => {
    try {
      const resp = await fetch(rec.url);
      const blob = await resp.blob();
      // reverbAmount is the single source of truth (0..2). Fall back to 0
      // (dry) if it hasn't been set yet, rather than the old boolean flag.
      const reverbAmount = (window as any).__reverbAmount ?? 0;
      await playBlobWithFx(blob, reverbAmount);
    } catch (err) {
      const audio = new Audio(rec.url);
      audio.volume = 0.9;
      audio.play().catch(() => {});
    }
    setHype((h) => Math.min(HYPE_LABELS.length - 1, h + 1));
    setShake(true);
    setTimeout(() => setShake(false), 400);
  }, []);

  // Pet emoji based on state
  const petEmoji = (() => {
    if (!activeKid) return "🐱";
    switch (petState) {
      case "covering": return "🙉";
      case "dancing": return "🕺";
      case "shocked": return "😱";
      default: return activeKid.avatar;
    }
  })();

  // (v23: sound pack filter removed — kids see all 34 animals by default.)
  const visiblePresets = PRESETS;

  const hypePct = (hype / (HYPE_LABELS.length - 1)) * 100;
  const hypeColor = hype < 2 ? "bg-green-400" : hype < 4 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className={`min-h-screen w-full flex flex-col ${shake ? "animate-shake" : ""}`} style={reverbMode ? { background: "linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)" } : { background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fbbf24 100%)" }}>

      {/* PWA Update banner */}
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-3 text-sm font-bold shadow-lg flex items-center justify-center gap-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <span>New version ready!</span>
          <button onClick={applyUpdate} className="bg-white text-amber-700 px-3 py-1 rounded-full font-bold active:scale-95">
            Update
          </button>
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-red-500 text-white text-center text-xs font-bold py-1.5">
          📡 Offline — using cached sounds
        </div>
      )}

      {/* iOS Install hint */}
      {showIosInstall && !isInstalledPwa() && (
        <div className="bg-amber-100 border-b-2 border-amber-400 px-4 py-2 text-amber-900 text-xs flex items-center justify-between gap-2">
          <span>📲 Install: tap <strong>Share</strong> → <strong>Add to Home Screen</strong></span>
          <button onClick={() => setShowIosInstall(false)} className="text-amber-900/70 font-bold px-2">✕</button>
        </div>
      )}

      {/* Android install button */}
      {installable && !isInstalledPwa() && !showIosInstall && (
        <div className="bg-emerald-100 border-b-2 border-emerald-400 px-4 py-2 text-emerald-900 text-xs flex items-center justify-between gap-2">
          <span>📲 Install Animal Farts on your phone</span>
          <button
            onClick={async () => {
              const ok = await promptInstall();
              if (ok) setInstallable(false);
            }}
            className="bg-emerald-500 text-white px-3 py-1 rounded-full font-bold active:scale-95"
          >
            Install
          </button>
        </div>
      )}

      <header className="px-4 pt-6 pb-3 text-center relative">
        <h1 className={`text-4xl sm:text-5xl font-bold drop-shadow-sm ${reverbMode ? "text-blue-900" : "text-amber-900"}`}>
          💨 ANIMAL FARTS 💨
        </h1>
        <p className={`text-base sm:text-lg mt-1 font-semibold ${reverbMode ? "text-blue-800" : "text-amber-800"}`}>
          Tap an animal. Hold your nose.
        </p>
        {/* Pet in top-right */}
        {activeKid && (
          <div className="absolute top-2 right-3 text-4xl drop-shadow-lg transition-transform hover:scale-110">
            {petEmoji}
          </div>
        )}
      </header>

      {/* Kid nav: 2 tabs. Parents page opens from the gear icon (PIN-gated). */}
      <div className="px-3 pb-3 flex gap-2 max-w-3xl mx-auto w-full items-center">
        <NavTab active={tab === "play"} onClick={() => setTab("play")} color="amber" emoji="🎵" label="Play" />
        <NavTab active={tab === "mystuff"} onClick={() => setTab("mystuff")} color="purple" emoji="🎤" label="My Sounds" />
        <button
          onClick={() => setPinGateOpen(true)}
          aria-label="Parents"
          className="ml-1 w-12 h-12 rounded-2xl bg-white/70 text-slate-600 border-2 border-slate-200 text-xl active:scale-95 flex items-center justify-center shadow-sm"
          title="Parents (PIN)"
        >
          👪
        </button>
      </div>

      {parentalBlocked && (
        <div className="mx-3 mb-3 p-3 bg-slate-700 text-white rounded-xl text-center text-sm font-bold">
          🔒 Quiet time! Come back during play hours. Ask a parent to change settings.
        </div>
      )}

      {/* Active Kid Pill — tap to switch / add / delete */}
      {profiles.length > 0 && tab === "play" && activeKid && (
        <div data-kid-menu-root className="px-3 pb-2 max-w-3xl mx-auto w-full relative">
          <button
            onClick={() => setShowKidMenu((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold shadow-md bg-gradient-to-br ${activeKid.color} text-white`}
          >
            <span className="text-lg">{activeKid.avatar}</span>
            <span>{activeKid.name}</span>
            <span className="text-xs opacity-80">▾</span>
          </button>
          {showKidMenu && (
            <div className="absolute z-40 mt-1 left-3 bg-white rounded-2xl shadow-xl border-2 border-purple-200 p-2 min-w-[200px]">
              <p className="text-xs text-purple-700 font-bold px-2 py-1 uppercase tracking-wider">Switch player</p>
              {profiles.map((kid) => (
                <button
                  key={kid.id}
                  onClick={() => { setActiveKidState(kid); setActiveKidId(kid.id); setShowKidMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left ${activeKid.id === kid.id ? "bg-purple-100" : "hover:bg-gray-100"}`}
                >
                  <span className="text-2xl">{kid.avatar}</span>
                  <span className="font-bold text-gray-800 flex-1">{kid.name}</span>
                  {activeKid.id === kid.id && <span className="text-purple-500">✓</span>}
                </button>
              ))}
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={() => { setShowProfileModal(true); setShowKidMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-purple-700 font-bold hover:bg-purple-50"
              >
                <span className="text-2xl">+</span> Add a kid
              </button>
              {profiles.length > 1 && (
                <button
                  onClick={() => {
                    if (confirm(`Delete ${activeKid.name}? Their stats and stickers will be removed.`)) {
                      const id = activeKid.id;
                      deleteKid(id);
                      const remaining = loadProfiles();
                      setProfiles(remaining);
                      if (remaining.length > 0) {
                        setActiveKidState(remaining[0]);
                        setActiveKidId(remaining[0].id);
                      } else {
                        setActiveKidState(null as any);
                        setActiveKidId(null);
                      }
                    }
                    setShowKidMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-red-600 font-bold hover:bg-red-50"
                >
                  <span className="text-2xl">✕</span> Delete {activeKid.name}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "play" && (
        <>
          {/* (v23: sound pack selector removed.) */}

          {/* Small hype indicator — optional, parents can hide in settings */}
          {showHypeMeter && (
            <div className="px-3 pb-2 max-w-3xl mx-auto w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-900/70">💨</span>
                <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                  <div className={`h-full ${hypeColor} transition-all duration-300`} style={{ width: `${hypePct}%` }} />
                </div>
                <span className="text-[10px] font-bold text-amber-900/60 whitespace-nowrap">{HYPE_LABELS[hype]}</span>
              </div>
            </div>
          )}

          {/* Cards — the fun part */}
          <PlayTab
            presets={visiblePresets}
            recordings={recordings}
            activeKid={activeKid}
            trigger={trigger}
            active={active}
            onPlayCustom={onPlayCustom}
            onDeleteRecording={onDeleteRecording}
            onStartRecord={onStartRecord}
            onStopRecord={onStopRecord}
            onDiscardPending={onDiscardPending}
            onShareRecording={onShareRecording}
            onOpenAddCode={() => { setAddCodeOpen(true); setShareError(null); }}
            recording={recording}
            recordDuration={recordDuration}
            recordError={recordError}
            showRecordModal={showRecordModal}
            setShowRecordModal={setShowRecordModal}
            pendingRecording={pendingRecording}
            setPendingRecording={setPendingRecording}
            newRecName={newRecName}
            setNewRecName={setNewRecName}
            newRecEmoji={newRecEmoji}
            setNewRecEmoji={setNewRecEmoji}
            parental={parental}
            parentalBlocked={parentalBlocked}
            primaryTab="animals"
          />
        </>
      )}

      {tab === "mystuff" && (
        <MyStuffTab
          profiles={profiles}
          setProfiles={setProfiles}
          activeKid={activeKid}
          setActiveKid={setActiveKidState}
          showProfileModal={showProfileModal}
          setShowProfileModal={setShowProfileModal}
        />
      )}

      {tab === "parental" && (
        <ParentalTab
          parental={parental}
          setParental={(s) => { saveParentalSettings(s); setParental(s); }}
          reverbMode={reverbMode}
          toggleReverb={toggleReverb}
          showHypeMeter={showHypeMeter}
          setShowHypeMeter={setShowHypeMeter}
        />
      )}

      {/* Action Bar (only on play tab) — fixed at bottom of viewport, with safe-area padding */}
      {tab === "play" && (
        <footer
          className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-2 max-w-3xl mx-auto">
            <button
              onPointerDown={onRandom}
              onClick={onRandom}
              className="flex-1 bg-gradient-to-br from-purple-400 to-pink-500 active:scale-95 transition-transform text-white font-extrabold text-xl py-5 rounded-2xl shadow-xl border-4 border-white"
            >
              🎲 SURPRISE ME
            </button>
            <button
              onPointerDown={onCombo}
              onClick={onCombo}
              className="flex-1 bg-gradient-to-br from-orange-500 to-red-500 active:scale-95 transition-transform text-white font-extrabold text-xl py-5 rounded-2xl shadow-xl border-4 border-white"
            >
              💥 COMBO
            </button>
          </div>
          <button
            onClick={async () => {
              const result = await share({
                title: "💨 Animal Farts",
                text: "Check out Animal Farts — 34 animals, recordings, stickers & more!",
                url: window.location.origin + "/?utm_source=share",
              });
              setShowShareToast(result);
              setTimeout(() => setShowShareToast(null), 2500);
            }}
            className="mt-2 w-full max-w-3xl mx-auto block font-bold text-sm py-2 rounded-xl border-2 bg-white/70 border-blue-300 text-blue-900 active:scale-95"
          >
            🔗 Share Animal Farts
          </button>
          {/* Audio modes row */}
          <div className="mt-2 w-full max-w-3xl mx-auto flex gap-1.5">
            {([
              { id: "normal", label: "Normal", emoji: "🔊", bg: "bg-white/70 text-slate-700 border-slate-300" },
              { id: "chipmunk", label: "Chipmunk", emoji: "🐿️", bg: "bg-yellow-100 text-yellow-900 border-yellow-400" },
              { id: "slowmo", label: "Slow-Mo", emoji: "🐢", bg: "bg-blue-100 text-blue-900 border-blue-400" },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => setAudioMode(m.id)}
                className={`flex-1 font-bold text-xs py-1.5 rounded-xl border-2 active:scale-95 ${audioMode === m.id ? m.bg + " ring-2 ring-amber-400" : "bg-white/50 text-slate-500 border-slate-200"}`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          {/* Reverb + pitch/speed sliders (only show when in normal mode) */}
          {audioMode === "normal" && (
            <div className="mt-2 w-full max-w-3xl mx-auto grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 bg-white/60 rounded-xl px-2 py-1.5">
                <span>🎵</span>
                <input type="range" min="0.5" max="1.5" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="flex-1" />
                <span className="font-bold w-8 text-right">{speed.toFixed(1)}x</span>
              </label>
              <label className="flex items-center gap-2 bg-white/60 rounded-xl px-2 py-1.5">
                <span>🎚️</span>
                <input type="range" min="-12" max="12" step="1" value={pitchShift} onChange={(e) => setPitchShift(parseInt(e.target.value))} className="flex-1" />
                <span className="font-bold w-8 text-right">{pitchShift > 0 ? "+" : ""}{pitchShift}</span>
              </label>
            </div>
          )}
          {/* Reverb toggle row */}
          <div className="mt-2 w-full max-w-3xl mx-auto flex gap-1.5">
            {([
              { id: 0, label: "Dry", emoji: "🔈" },
              { id: 1, label: "Bathroom", emoji: "🚿" },
              { id: 2, label: "Cave", emoji: "🦇" },
            ] as const).map((r) => (
              <button
                key={r.id}
                onClick={() => setReverbAmountState(r.id)}
                className={`flex-1 font-bold text-xs py-1.5 rounded-xl border-2 active:scale-95 ${reverbAmount === r.id ? (r.id === 0 ? "bg-white/70 text-slate-700 border-slate-400 ring-2 ring-amber-400" : r.id === 1 ? "bg-cyan-100 text-cyan-900 border-cyan-400 ring-2 ring-amber-400" : "bg-indigo-100 text-indigo-900 border-indigo-400 ring-2 ring-amber-400") : "bg-white/40 text-slate-400 border-slate-200"}`}
              >
                {r.emoji} {r.label}
              </button>
            ))}
          </div>
        </footer>
      )}

      {/* Share toast */}
      {showShareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg">
          {showShareToast === "shared" && "✅ Shared!"}
          {showShareToast === "copied" && "📋 Link copied!"}
          {showShareToast === "unsupported" && "Couldn't share"}
        </div>
      )}

      {/* Parents gate — opens from the gear icon. On success, jump to the
          parental tab. The gate is mounted at App level so it's reachable
          from anywhere, not just inside ParentalTab. */}
      <PinGate
        open={pinGateOpen}
        onClose={() => setPinGateOpen(false)}
        onSuccess={() => { setPinGateOpen(false); setTab("parental"); }}
        title="Parent PIN"
      >
        {() => null}
      </PinGate>

      {/* Show a freshly-minted share code */}
      {shareModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShareModal(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            {shareModal.success ? (
              <>
                <div className="text-6xl mb-2">{shareModal.emoji}</div>
                <h2 className="text-2xl font-bold text-emerald-900 mb-1">Got it!</h2>
                <p className="text-sm text-slate-600 mb-4">"{shareModal.name}" is now in your library.</p>
                <button
                  onClick={() => setShareModal(null)}
                  className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95"
                >
                  OK
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">🔗</div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">Your share code</h2>
                <p className="text-sm text-slate-600 mb-4">Read this to your friend. They tap 🔗 CODE and type it in.</p>
                <div className="font-mono font-bold text-5xl tracking-[0.5em] text-emerald-700 bg-emerald-50 rounded-2xl py-6 mb-4 select-all">
                  {shareModal.code}
                </div>
                <button
                  onClick={() => setShareModal(null)}
                  className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold active:scale-95"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Enter a code you got from a friend */}
      {addCodeOpen && (
        <AddCodeModal
          onClose={() => setAddCodeOpen(false)}
          onAdd={onAddByCode}
          busy={shareBusy}
          error={shareError}
        />
      )}

      {/* Poof particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {poofs.map((p) => (
          <div key={p.id} className="absolute text-4xl animate-poof" style={{ left: p.x - 20, top: p.y - 20 }}>
            {p.emoji}
          </div>
        ))}
      </div>

      {/* Combo popup */}
      {comboPopup && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-lg pointer-events-none animate-bounce">
          🎉 {comboPopup}!
        </div>
      )}

      {/* Emoji Rain */}
      {emojiRainActive && (
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-3xl animate-poof"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random() * 1}s`,
              }}
            >
              {EMOJI_RAIN[Math.floor(Math.random() * EMOJI_RAIN.length)]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

function NavTab({ active, onClick, color, emoji, label }: { active: boolean; onClick: () => void; color: "amber" | "emerald" | "purple" | "slate" | "orange"; emoji: string; label: string }) {
  const colors = {
    amber: { active: "bg-amber-500 text-white shadow-lg", idle: "bg-white/70 text-amber-900 border-2 border-amber-200" },
    emerald: { active: "bg-emerald-500 text-white shadow-lg", idle: "bg-white/70 text-emerald-900 border-2 border-emerald-200" },
    purple: { active: "bg-purple-500 text-white shadow-lg", idle: "bg-white/70 text-purple-900 border-2 border-purple-200" },
    slate: { active: "bg-slate-700 text-white shadow-lg", idle: "bg-white/70 text-slate-700 border-2 border-slate-200" },
    orange: { active: "bg-orange-500 text-white shadow-lg", idle: "bg-white/70 text-orange-900 border-2 border-orange-200" },
  };
  const cls = active ? colors[color].active : colors[color].idle;
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 ${cls}`}
    >
      <span className="text-xl mr-1">{emoji}</span>
      {label}
    </button>
  );
}
      {/* (v23: removed StatCard, SubTab, and the kid stats card.) */}


function PlayTab(props: {
  presets: FartPreset[];
  recordings: CustomRecording[];
  activeKid: Kid | null;
  trigger: (p: FartPreset, e?: React.MouseEvent | React.TouchEvent) => void;
  active: string | null;
  onPlayCustom: (rec: CustomRecording) => void;
  onDeleteRecording: (id: string) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onDiscardPending: () => void;
  onShareRecording: (rec: CustomRecording) => void;
  onOpenAddCode: () => void;
  recording: boolean;
  recordDuration: number;
  recordError: string | null;
  showRecordModal: boolean;
  setShowRecordModal: (v: boolean) => void;
  pendingRecording: { url: string; duration: number; blob: Blob } | null;
  setPendingRecording: (v: any) => void;
  newRecName: string;
  setNewRecName: (v: string) => void;
  newRecEmoji: string;
  setNewRecEmoji: (v: string) => void;
  parental: ParentalSettings;
  parentalBlocked: boolean;
  primaryTab: string;
}) {
  // (v23: sub-tab bar removed. Recordings + animals share one scrollable
  // page; the action bar at the bottom handles voice effects.)
  const [showAllAnimals, setShowAllAnimals] = useState(false);
  // First 12 animals on first screen; "See all" reveals the rest
  const HERO_COUNT = 12;
  const visiblePresets = showAllAnimals ? props.presets : props.presets.slice(0, HERO_COUNT);

  return (
    <>
      <main className="flex-1 px-3 pb-44">
        <p className="text-center text-purple-900/70 text-sm font-semibold mb-2">
          Hold the phone close and make a funny sound — we use your mic to save it here.
        </p>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { props.setShowRecordModal(true); }}
            className="flex-1 py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-lg shadow-xl border-4 border-white active:scale-95"
          >
            🎤 RECORD
          </button>
          <button
            onClick={props.onOpenAddCode}
            className="px-4 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-base shadow-xl border-4 border-white active:scale-95"
            title="Got a 4-letter code? Tap here"
          >
            🔗 CODE
          </button>
        </div>
        {props.recordings.length === 0 ? (
          <div className="text-center text-purple-900/60 py-8 px-4">
            <div className="text-5xl mb-2">🎤</div>
            <p className="font-semibold">No recordings yet</p>
            <p className="text-sm">Make your first one! Be silly. Be loud. 💨</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {props.recordings.map((rec) => (
              <RecordingTile key={rec.id} rec={rec} onPlay={props.onPlayCustom} onDelete={props.onDeleteRecording} onShare={props.onShareRecording} />
            ))}
          </div>
        )}

        <h2 className="text-center text-2xl sm:text-3xl font-bold text-amber-900 mt-6 mb-3">🐾 Tap an animal</h2>
        <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
          {visiblePresets.map((p) => (
            <AnimalCard key={p.id} preset={p} active={props.active === p.id} onPlay={props.trigger} />
          ))}
        </div>
        {props.presets.length > HERO_COUNT && (
          <div className="text-center mt-4">
            <button
              onClick={() => setShowAllAnimals((v) => !v)}
              className="px-5 py-2 rounded-full bg-white/80 text-amber-900 border-2 border-amber-300 font-bold text-sm active:scale-95"
            >
              {showAllAnimals ? "← Show fewer" : `See all ${props.presets.length} →`}
            </button>
          </div>
        )}
      </main>

      {/* Record Modal */}
      {props.showRecordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            {!props.recording && !props.pendingRecording && (
              <div className="text-center">
                <div className="text-6xl mb-3">🎤</div>
                <h2 className="text-2xl font-bold text-purple-900 mb-2">Record a Fart</h2>
                <p className="text-gray-600 mb-4 text-sm">Tap the mic, then make your sound!</p>
                {props.recordError && (
                  <div className="bg-red-100 border-2 border-red-300 text-red-800 rounded-xl p-3 mb-4 text-sm">
                    {props.recordError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => props.setShowRecordModal(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={props.onStartRecord}
                    className="flex-1 py-3 rounded-xl bg-purple-500 text-white font-bold active:scale-95"
                  >
                    🎤 Start
                  </button>
                </div>
              </div>
            )}
            {props.recording && (
              <div className="text-center">
                <div className="text-6xl mb-3 animate-pulse">🔴</div>
                <h2 className="text-2xl font-bold text-red-600 mb-2">RECORDING</h2>
                <div className="text-3xl font-mono font-bold text-gray-800 mb-4">
                  {props.recordDuration.toFixed(1)}s
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-red-500 animate-pulse" style={{ width: "100%" }} />
                </div>
                <button
                  onClick={props.onStopRecord}
                  className="w-full py-4 rounded-xl bg-red-500 text-white font-bold text-lg active:scale-95"
                >
                  ⏹ STOP
                </button>
              </div>
            )}
            {props.pendingRecording && (
              <div className="text-center">
                <div className="text-6xl mb-3">✨</div>
                <h2 className="text-2xl font-bold text-purple-900 mb-1">Saved!</h2>
                <p className="text-gray-600 mb-4 text-sm">"{props.newRecName}" is in your library.</p>
                <button
                  onClick={props.onDiscardPending}
                  className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95"
                >
                  ✓ OK
                </button>
                <p className="text-xs text-gray-500 mt-2">Tap the 🔗 on the tile to share with a code.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// === My Stuff tab — wraps profile, stickers, daily into one tab with sub-nav ===
function MyStuffTab(props: {
  profiles: Kid[];
  setProfiles: (p: Kid[]) => void;
  activeKid: Kid | null;
  setActiveKid: (k: Kid) => void;
  showProfileModal: boolean;
  setShowProfileModal: (v: boolean) => void;
}) {
  // v23: my-stuff is just the kid picker / profile. Stickers and daily
  // challenges are gone — kids don't use them.
  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <ProfileTab {...props} />
    </main>
  );
}

function ProfileTab({
  profiles, setProfiles, activeKid, setActiveKid, showProfileModal, setShowProfileModal,
}: {
  profiles: Kid[]; setProfiles: (p: Kid[]) => void; activeKid: Kid | null;
  setActiveKid: (k: Kid) => void; showProfileModal: boolean; setShowProfileModal: (v: boolean) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("🐱");
  const avatarChoices = getAvatarChoices();

  // Auto-open modal if no profiles
  useEffect(() => {
    if (profiles.length === 0) setShowProfileModal(true);
  }, [profiles.length, setShowProfileModal]);

  const onAddKid = () => {
    if (!newName.trim()) return;
    const choice = avatarChoices.find((a) => a.emoji === newAvatar) || avatarChoices[0];
    const kid = createKid(newName.trim(), choice.emoji, choice.color);
    setProfiles([...profiles, kid]);
    setActiveKid(kid);
    setActiveKidId(kid.id);
    setNewName("");
    setShowProfileModal(false);
  };

  const onDeleteKid = (id: string) => {
    if (!confirm("Delete this kid? Their recordings and stickers will be removed.")) return;
    deleteKid(id);
    const remaining = loadProfiles();
    setProfiles(remaining);
    if (remaining.length > 0) {
      setActiveKid(remaining[0]);
      setActiveKidId(remaining[0].id);
    } else {
      setActiveKid(null as any);
      setActiveKidId(null);
    }
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-bold text-purple-900">👤 Who is playing?</h2>
        <button
          onClick={() => setShowProfileModal(true)}
          className="px-4 py-2 rounded-full bg-purple-500 text-white font-bold text-sm active:scale-95"
        >
          + Add Kid
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12 text-purple-900/60">
          <div className="text-6xl mb-3">👶</div>
          <p className="font-semibold">No kids added yet</p>
          <p className="text-sm">Tap "Add Kid" to start playing!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {profiles.map((kid) => {
            const stats = getStats(kid.id);
            const isActive = activeKid?.id === kid.id;
            return (
              <div
                key={kid.id}
                className={`relative rounded-3xl shadow-xl border-4 ${isActive ? "border-purple-500 ring-4 ring-purple-300" : "border-white"} bg-gradient-to-br ${kid.color} p-4 active:scale-95 transition-all`}
              >
                <button
                  onClick={() => { setActiveKid(kid); setActiveKidId(kid.id); }}
                  className="w-full"
                >
                  <div className="text-6xl mb-2">{kid.avatar}</div>
                  <div className="text-xl font-bold text-white drop-shadow truncate">{kid.name}</div>
                  <div className="text-xs text-white/80 mt-1">
                    {stats.totalTaps} toots · {stats.recordings} recs
                  </div>
                </button>
                <button
                  onClick={() => onDeleteKid(kid.id)}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-purple-900 mb-4 text-center">Add a Kid!</h2>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="What's your name?"
              maxLength={15}
              className="w-full px-4 py-3 rounded-xl border-2 border-purple-300 text-center font-bold text-lg mb-4"
              autoFocus
            />
            <p className="text-sm text-gray-600 mb-2 text-center">Pick an avatar:</p>
            <div className="grid grid-cols-6 gap-2 mb-4">
              {avatarChoices.map((a) => (
                <button
                  key={a.emoji}
                  onClick={() => setNewAvatar(a.emoji)}
                  className={`text-3xl p-2 rounded-xl ${newAvatar === a.emoji ? "bg-purple-200 ring-2 ring-purple-500" : "bg-gray-100"}`}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {profiles.length > 0 && (
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={onAddKid}
                disabled={!newName.trim()}
                className="flex-1 py-3 rounded-xl bg-purple-500 text-white font-bold active:scale-95 disabled:opacity-50"
              >
                Add!
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function ParentalTab({
  parental,
  setParental,
  reverbMode,
  toggleReverb,
  showHypeMeter,
  setShowHypeMeter,
}: {
  parental: ParentalSettings;
  setParental: (s: ParentalSettings) => void;
  reverbMode: boolean;
  toggleReverb: () => void;
  showHypeMeter: boolean;
  setShowHypeMeter: (v: boolean) => void;
}) {
  const [local, setLocal] = useState(parental);
  // (v23: push notification shell removed — server has no push handler,
  // so the UI was just a no-op that confused parents.)

  const update = <K extends keyof ParentalSettings>(key: K, value: ParentalSettings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    setParental(next);
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">👪 Grown-Up Settings</h2>
      <p className="text-sm text-slate-700/70 text-center mb-4">Quiet hours, daily limits, and more.</p>

      {/* (v23: notification permission card removed — server has no push handler.) */}

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-bold text-slate-800">Enable Play-Time Limits</div>
            <div className="text-xs text-slate-600">App only works during certain hours</div>
          </div>
          <input
            type="checkbox"
            checked={local.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            className="w-6 h-6"
          />
        </label>
      </div>

      {local.enabled && (
        <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
          <h3 className="font-bold text-slate-800 mb-3">Play Hours</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-600">From</label>
              <select
                value={local.startHour}
                onChange={(e) => update("startHour", parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 font-bold"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-600">Until</label>
              <select
                value={local.endHour}
                onChange={(e) => update("endHour", parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 font-bold"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <h3 className="font-bold text-slate-800 mb-2">Daily Recording Limit</h3>
        <p className="text-xs text-slate-600 mb-3">Set to 0 for unlimited</p>
        <input
          type="number"
          min={0}
          max={100}
          value={local.dailyRecordingLimit}
          onChange={(e) => update("dailyRecordingLimit", Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full px-3 py-2 rounded-lg border-2 border-slate-300 font-bold text-lg"
        />
        <p className="text-xs text-slate-600 mt-2">Today's recordings: {getTodayRecordingsCount()}</p>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-bold text-slate-800">Mute All Sounds</div>
            <div className="text-xs text-slate-600">No audio plays at all (parent sanity mode)</div>
          </div>
          <input
            type="checkbox"
            checked={local.mute}
            onChange={(e) => update("mute", e.target.checked)}
            className="w-6 h-6"
          />
        </label>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-bold text-slate-800">🚿 Bathroom Echo by Default</div>
            <div className="text-xs text-slate-600">All sounds play with bathroom reverb</div>
          </div>
          <input
            type="checkbox"
            checked={reverbMode}
            onChange={toggleReverb}
            className="w-6 h-6"
          />
        </label>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-bold text-slate-800">💨 Show Hype Meter</div>
            <div className="text-xs text-slate-600">Visible progress bar in the Play tab</div>
          </div>
          <input
            type="checkbox"
            checked={showHypeMeter}
            onChange={(e) => setShowHypeMeter(e.target.checked)}
            className="w-6 h-6"
          />
        </label>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <button
          onClick={() => { stopAllSounds(); }}
          className="w-full py-3 rounded-xl bg-red-500 text-white font-bold active:scale-95"
        >
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

// === Explore Tab — moved to SocialTab ===
void 0; // (ExploreTab removed in v15; replaced by Instagram-style SocialTab)
