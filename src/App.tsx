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
  setRecordingVisibility,
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
  getHealth,
  getMe,
  updateMe,
  getUsers,
  toggleFollow,
  getUserRecordings,
  getFeed,
  uploadCustomRecording,
  getComments,
  addComment,
  deleteComment,
  type SocialUser,
  type SocialComment,
  type FeedGroup,
  type FeedRecording,
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
  getAnimalsTried,
  checkAchievements,
  getUnlockedAchievements,
  ACHIEVEMENTS,
  addSticker,
  loadStickerBoard,
  removeSticker,
  moveSticker,
  getUnlockedPacks,
  SOUND_PACKS,
  getSelectedPack,
  setSelectedPack,
  getTodayChallenge,
  getTodayProgress,
  setTodayProgress,
  loadParentalSettings,
  saveParentalSettings,
  isPlayTimeAllowed,
  getTodayRecordingsCount,
  incrementTodayRecordings,
  getAvatarChoices,
  getComboName,
  type Kid,
  type PlacedSticker,
  type ParentalSettings,
  type Achievement,
} from "./game/state";
import { isAdultMode, setAdultMode as setAdultModePersist } from "./game/adultMode";
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

function RecordingTile({ rec, onPlay, onDelete }: { rec: CustomRecording; onPlay: (rec: CustomRecording) => void; onDelete: (id: string) => void }) {
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
      {rec.visibility === "public" && (
        <div
          aria-label="Public recording"
          title="Posted to feed"
          className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 text-white text-[9px] font-bold shadow"
        >
          🌍
        </div>
      )}
      <button
        onClick={() => onDelete(rec.id)}
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        ✕
      </button>
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

  // Social state (Instagram-like)
  const [me, setMe] = useState<SocialUser | null>(null);
  const [socialView, setSocialView] = useState<"feed" | "discover" | "profile" | "viewProfile">("feed");
  const [viewedUser, setViewedUser] = useState<SocialUser | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

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
  const [adultMode, setAdultModeState] = useState<boolean>(() => isAdultMode());
  const [emojiRainActive, setEmojiRainActive] = useState(false);
  const [petState, setPetState] = useState<"happy" | "covering" | "dancing" | "shocked">("happy");
  const [recentTaps, setRecentTaps] = useState<{ id: string; time: number }[]>([]);
  // Suppress TS6133 for recentTaps when it isn't read directly; it triggers re-renders for combo popups
  const _recentTapsRef = recentTaps; void _recentTapsRef;
  const [comboPopup, setComboPopup] = useState<string | null>(null);
  const [achievementPopup, setAchievementPopup] = useState<Achievement | null>(null);
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

  // Check achievements after stats updates
  const checkAchievementsAndNotify = useCallback((kidId: string) => {
    const newlyUnlocked = checkAchievements(kidId);
    if (newlyUnlocked.length > 0) {
      setAchievementPopup(newlyUnlocked[0]);
      setTimeout(() => setAchievementPopup(null), 4000);
    }
  }, []);

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
      // Daily challenge progress
      const challenge = getTodayChallenge();
      if (challenge.metric === "mostTaps") {
        const cur = getTodayProgress(activeKid.id, "mostTaps");
        setTodayProgress(activeKid.id, "mostTaps", cur + 1);
      } else if (challenge.metric === "mostUniqueAnimals") {
        const tried = getAnimalsTried(activeKid.id);
        setTodayProgress(activeKid.id, "mostUniqueAnimals", tried.length);
      }
      checkAchievementsAndNotify(activeKid.id);
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
  }, [activeKid, reverbMode, parentalBlocked, parental.mute, checkAchievementsAndNotify, recordTapForCombo]);

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
      setPendingRecording({ url: result.url, duration: result.duration, blob: result.blob });
      setNewRecName(`My Fart ${recordings.length + 1}`);
      setNewRecEmoji("💨");
    }
  }, [recording, recordings.length]);

  // Save the recording to this device only. Always works offline.
  const onSaveLocal = useCallback(() => {
    if (!pendingRecording) return;
    const rec = saveRecording({
      name: newRecName || "My Fart",
      emoji: newRecEmoji,
      url: pendingRecording.url,
      visibility: "local",
    });
    setRecordings([...recordings, rec]);
    if (activeKid) {
      incrementTodayRecordings();
      updateStats(activeKid.id, (s) => ({
        ...s,
        recordings: s.recordings + 1,
        longestRecordingSec: Math.max(s.longestRecordingSec, pendingRecording.duration),
      }));
      const challenge = getTodayChallenge();
      if (challenge.metric === "longestRecording") {
        const cur = getTodayProgress(activeKid.id, "longestRecording");
        if (pendingRecording.duration > cur) {
          setTodayProgress(activeKid.id, "longestRecording", pendingRecording.duration);
        }
      }
      checkAchievementsAndNotify(activeKid.id);
    }
    setPendingRecording(null);
    setShowRecordModal(false);
  }, [pendingRecording, newRecName, newRecEmoji, recordings, activeKid, checkAchievementsAndNotify]);

  // Save locally AND upload to the public feed. Uploads run async; the
  // local row is created immediately so the user can keep playing with
  // it even if the network fails.
  const onPostToFeed = useCallback(async () => {
    if (!pendingRecording) return;
    const rec = saveRecording({
      name: newRecName || "My Fart",
      emoji: newRecEmoji,
      url: pendingRecording.url,
      visibility: "local",
    });
    setRecordings([...recordings, rec]);
    if (activeKid) {
      incrementTodayRecordings();
      updateStats(activeKid.id, (s) => ({
        ...s,
        recordings: s.recordings + 1,
        longestRecordingSec: Math.max(s.longestRecordingSec, pendingRecording.duration),
      }));
      checkAchievementsAndNotify(activeKid.id);
    }
    setPendingRecording(null);
    setShowRecordModal(false);
    try {
      const shared = await uploadCustomRecording(rec, activeKid?.name);
      setRecordings((cur) =>
        cur.map((r) => (r.id === rec.id ? { ...r, visibility: "public" as const, serverId: String(shared.id) } : r))
      );
      setRecordingVisibility(rec.id, "public", String(shared.id));
      // Notify the social tab (if mounted) that the feed has new content
      window.dispatchEvent(new CustomEvent("animal-farts:feed-changed"));
    } catch (err) {
      // Network failed — keep the local copy, do NOT pretend it posted.
      alert("Couldn't post to feed (no internet?) — saved on this device only.");
    }
  }, [pendingRecording, newRecName, newRecEmoji, recordings, activeKid, checkAchievementsAndNotify]);

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

  const onPlayCustom = useCallback(async (rec: CustomRecording) => {
    try {
      const resp = await fetch(rec.url);
      const blob = await resp.blob();
      const reverbAmount = (window as any).__reverbAmount ?? ((window as any).__reverbEnabled ? 1 : 0);
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

  // Selected pack filter
  const selectedPackId = activeKid ? getSelectedPack(activeKid.id) : null;
  const selectedPack = SOUND_PACKS.find((p) => p.id === selectedPackId);
  const visiblePresets = selectedPack
    ? PRESETS.filter((p) => selectedPack.animalIds.includes(p.id))
    : PRESETS;

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

      {/* Top tabs — kid-facing nav: 4 tabs, room to breathe */}
      <div className="px-3 pb-3 flex gap-2 max-w-3xl mx-auto w-full">
        <NavTab active={tab === "play"} onClick={() => setTab("play")} color="amber" emoji="🎵" label="Play" />
        <NavTab active={tab === "explore"} onClick={() => setTab("explore")} color="emerald" emoji="🌍" label="Explore" />
        <NavTab active={tab === "mystuff"} onClick={() => setTab("mystuff")} color="purple" emoji="📦" label="My Stuff" />
        <NavTab active={tab === "parental"} onClick={() => setTab("parental")} color="slate" emoji="⚙️" label="Parents" />
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
          {/* Sound Pack Selector — small, useful for variety */}
          {activeKid && (
            <div className="px-3 pb-2 max-w-3xl mx-auto w-full">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedPack(activeKid.id, null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${!selectedPackId ? "bg-amber-500 text-white" : "bg-white/60 text-gray-700"}`}
                >
                  🎵 All
                </button>
                {getUnlockedPacks(activeKid.id).slice(0, 3).map((pack) => (
                  <button
                    key={pack.id}
                    onClick={() => setSelectedPack(activeKid.id, pack.id === selectedPackId ? null : pack.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${selectedPackId === pack.id ? "bg-amber-500 text-white" : "bg-white/60 text-gray-700"}`}
                  >
                    {pack.emoji} {pack.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            onSaveLocal={onSaveLocal}
            onPostToFeed={onPostToFeed}
            onDiscardPending={onDiscardPending}
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

      {tab === "explore" && (
        <SocialTab
          me={me} setMe={setMe}
          activeKid={activeKid} recordings={recordings}
          socialView={socialView} setSocialView={setSocialView}
          viewedUser={viewedUser} setViewedUser={setViewedUser}
          editingProfile={editingProfile} setEditingProfile={setEditingProfile}
          adultMode={adultMode}
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
          adultMode={adultMode}
          setAdultMode={(v) => { setAdultModePersist(v); setAdultModeState(v); }}
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

      {/* Achievement popup */}
      {achievementPopup && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-center pointer-events-none">
          <div className="text-4xl mb-1">{achievementPopup.emoji}</div>
          <div className="text-sm uppercase">Achievement Unlocked!</div>
          <div className="text-lg">{achievementPopup.name}</div>
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

function NavTab({ active, onClick, color, emoji, label }: { active: boolean; onClick: () => void; color: "amber" | "emerald" | "purple" | "slate"; emoji: string; label: string }) {
  const colors = {
    amber: { active: "bg-amber-500 text-white shadow-lg", idle: "bg-white/70 text-amber-900 border-2 border-amber-200" },
    emerald: { active: "bg-emerald-500 text-white shadow-lg", idle: "bg-white/70 text-emerald-900 border-2 border-emerald-200" },
    purple: { active: "bg-purple-500 text-white shadow-lg", idle: "bg-white/70 text-purple-900 border-2 border-purple-200" },
    slate: { active: "bg-slate-700 text-white shadow-lg", idle: "bg-white/70 text-slate-700 border-2 border-slate-200" },
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white/80 rounded-lg p-2">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="font-bold text-lg text-orange-900">{value}</div>
    </div>
  );
}

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
  onSaveLocal: () => void;
  onPostToFeed: () => void;
  onDiscardPending: () => void;
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
  const [sub, setSub] = useState<"animals" | "voice" | "myfarts">("animals");
  const EMOJI_CHOICES = ["💨", "🎤", "🤪", "😈", "👻", "👽", "💀", "🤡", "🦄", "🐸", "🐵", "🐷", "🐮", "🐔", "🐧", "🐢", "🐬", "🦖"];

  return (
    <>
      {/* Sub-tab bar — segmented control style, clearly secondary to main nav */}
      <div className="px-3 pb-3 max-w-3xl mx-auto w-full">
        <div className="bg-white/50 backdrop-blur rounded-full p-1 flex gap-0.5 border border-amber-200/50">
          {[
            { id: "animals" as const, label: "🐾 Animals" },
            { id: "voice" as const, label: "🎭 Voice" },
            { id: "myfarts" as const, label: "🎤 My Farts" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-all ${sub === t.id ? "bg-amber-500 text-white shadow" : "text-amber-900"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-3 pb-44">
        {sub === "voice" ? (
          <VoiceTabInline />
        ) : sub === "myfarts" ? (
          <div>
            <p className="text-center text-purple-900/70 text-sm font-semibold mb-2">
              Hold the phone close and make a funny sound — we use your mic to save it here.
            </p>
            <button
              onClick={() => { props.setShowRecordModal(true); }}
              className="w-full mb-3 py-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold text-lg shadow-xl border-4 border-white active:scale-95"
            >
              🎤 RECORD A FART
            </button>
            {props.recordings.length === 0 ? (
              <div className="text-center text-purple-900/60 py-12 px-4">
                <div className="text-6xl mb-3">🎤</div>
                <p className="font-semibold">No recordings yet</p>
                <p className="text-sm">Make your first one! Be silly. Be loud. 💨</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                {props.recordings.map((rec) => (
                  <RecordingTile key={rec.id} rec={rec} onPlay={props.onPlayCustom} onDelete={props.onDeleteRecording} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {props.presets.map((p) => (
              <AnimalCard key={p.id} preset={p} active={props.active === p.id} onPlay={props.trigger} />
            ))}
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
                <div className="text-5xl mb-3">✨</div>
                <h2 className="text-2xl font-bold text-purple-900 mb-2">Save your fart!</h2>
                <p className="text-gray-600 mb-3 text-sm">Duration: {props.pendingRecording.duration.toFixed(1)}s</p>
                <input
                  type="text"
                  value={props.newRecName}
                  onChange={(e) => props.setNewRecName(e.target.value)}
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
                        onClick={() => props.setNewRecEmoji(e)}
                        className={`text-2xl p-1.5 rounded-lg ${props.newRecEmoji === e ? "bg-purple-200 ring-2 ring-purple-500" : "bg-gray-100"}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={props.onDiscardPending}
                    className="flex-1 min-w-[6rem] py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                  >
                    🗑️ Discard
                  </button>
                  <button
                    onClick={props.onSaveLocal}
                    className="flex-1 min-w-[6rem] py-3 rounded-xl bg-purple-500 text-white font-bold active:scale-95"
                  >
                    💾 Save to my farts
                  </button>
                  <button
                    onClick={props.onPostToFeed}
                    className="flex-1 min-w-[6rem] py-3 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 text-white font-bold active:scale-95"
                  >
                    🌍 Post to feed
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Save to my farts = only on this device. Post to feed = your friends can hear it.
                </p>
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
  const [section, setSection] = useState<"player" | "stickers" | "daily">("player");

  if (!props.activeKid) {
    return (
      <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
        <ProfileTab {...props} />
      </main>
    );
  }

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <div className="flex gap-2 mb-3 bg-white/60 rounded-2xl p-1">
        <SubTab active={section === "player"} onClick={() => setSection("player")} label="👤 Player" />
        <SubTab active={section === "stickers"} onClick={() => setSection("stickers")} label="⭐ Stickers" />
        <SubTab active={section === "daily"} onClick={() => setSection("daily")} label="📅 Daily" />
      </div>

      {section === "player" && <ProfileTab {...props} />}
      {section === "stickers" && <StickerTab kidId={props.activeKid.id} />}
      {section === "daily" && <DailyTab kidId={props.activeKid.id} />}
    </main>
  );
}

function SubTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${active ? "bg-purple-500 text-white shadow" : "text-purple-900"}`}
    >
      {label}
    </button>
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

function StickerTab({ kidId }: { kidId: string }) {
  const [stickerBoard, setStickerBoardState] = useState<PlacedSticker[]>(loadStickerBoard(kidId));
  const unlocked = new Set(getUnlockedAchievements(kidId));

  // Refresh board when kidId changes
  useEffect(() => { setStickerBoardState(loadStickerBoard(kidId)); }, [kidId]);

  const onPlaceSticker = (achievementId: string) => {
    if (!unlocked.has(achievementId)) return;
    addSticker(kidId, achievementId);
    setStickerBoardState(loadStickerBoard(kidId));
  };

  const onDragSticker = (stickerId: string, e: React.PointerEvent) => {
    if (e.type !== "pointerdown") return;
    const board = document.getElementById("sticker-board");
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      moveSticker(kidId, stickerId, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setStickerBoardState(loadStickerBoard(kidId));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onRemoveSticker = (stickerId: string) => {
    removeSticker(kidId, stickerId);
    setStickerBoardState(loadStickerBoard(kidId));
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-pink-900 mb-3 text-center">⭐ Your Sticker Board</h2>
      <p className="text-sm text-pink-900/70 text-center mb-3">Unlock stickers by hitting achievements. Drag them around!</p>

      {/* Board */}
      <div
        id="sticker-board"
        className="relative bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl border-4 border-pink-300 mb-4"
        style={{ aspectRatio: "1.4", minHeight: "300px" }}
      >
        {stickerBoard.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-pink-900/50 text-center">
            <div>
              <div className="text-4xl mb-2">📋</div>
              <p className="font-semibold">Empty board</p>
              <p className="text-sm">Tap an unlocked achievement below!</p>
            </div>
          </div>
        )}
        {stickerBoard.map((s) => {
          const ach = ACHIEVEMENTS.find((a) => a.id === s.achievementId);
          return (
            <div
              key={s.id}
              onPointerDown={(e) => onDragSticker(s.id, e)}
              onDoubleClick={() => onRemoveSticker(s.id)}
              className="absolute text-5xl cursor-move select-none"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
                filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.2))",
              }}
              title={`${ach?.name} — double-tap to remove`}
            >
              {ach?.emoji || "⭐"}
            </div>
          );
        })}
      </div>

      {/* Achievements grid */}
      <h3 className="text-lg font-bold text-pink-900 mb-2">🏆 Achievements ({unlocked.size}/{ACHIEVEMENTS.length})</h3>
      <div className="grid grid-cols-4 gap-2">
        {ACHIEVEMENTS.map((ach) => {
          const isUnlocked = unlocked.has(ach.id);
          const placed = stickerBoard.some((s) => s.achievementId === ach.id);
          return (
            <button
              key={ach.id}
              onClick={() => isUnlocked && !placed && onPlaceSticker(ach.id)}
              disabled={!isUnlocked || placed}
              className={`p-2 rounded-xl text-center ${isUnlocked ? (placed ? "bg-green-100 opacity-50" : "bg-yellow-100 active:scale-95") : "bg-gray-100 opacity-40"}`}
            >
              <div className="text-3xl">{ach.emoji}</div>
              <div className="text-[10px] font-bold mt-1">{ach.name}</div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

function DailyTab({ kidId }: { kidId: string }) {
  const challenge = getTodayChallenge();
  const progress = getTodayProgress(kidId, challenge.metric);

  // Format progress for a given value
  const formatProgress = (value: number): string => {
    switch (challenge.metric) {
      case "longestRecording": return `${value.toFixed(1)}s`;
      case "mostTaps": return `${value} toots`;
      case "mostCombos": return `${value} combos`;
      case "mostUniqueAnimals": return `${value}/${PRESETS.length} animals`;
    }
  };

  // Top score for this challenge (across all kids)
  const allProfiles = loadProfiles();
  const leaderboard = allProfiles.map((kid) => ({
    kid,
    score: getTodayProgress(kid.id, challenge.metric),
  })).sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-orange-900 mb-1 text-center">📅 Today's Challenge</h2>
      <p className="text-sm text-orange-900/70 text-center mb-4">{new Date().toDateString()}</p>

      <div className="bg-gradient-to-br from-orange-100 to-yellow-100 rounded-3xl p-6 shadow-xl border-4 border-orange-300 mb-4 text-center">
        <div className="text-5xl mb-2">🏆</div>
        <h3 className="text-xl font-bold text-orange-900 mb-2">{challenge.prompt}</h3>
        <div className="text-3xl font-bold text-orange-700">{formatProgress(progress)}</div>
        <p className="text-sm text-orange-900/70 mt-2">Keep going! Set a new record today.</p>
      </div>

      <h3 className="text-lg font-bold text-orange-900 mb-2">🥇 Today's Leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p className="text-orange-900/60 text-sm">No entries yet. Be the first!</p>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, i) => {
            const isMe = entry.kid.id === kidId;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
            return (
              <div
                key={entry.kid.id}
                className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? "bg-orange-200 ring-2 ring-orange-500" : "bg-white/60"}`}
              >
                <div className="text-2xl w-8">{medal}</div>
                <div className="text-2xl">{entry.kid.avatar}</div>
                <div className="flex-1 font-bold text-gray-800">{entry.kid.name}</div>
                <div className="font-bold text-orange-700">{formatProgress(entry.score)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 bg-white/60 rounded-2xl p-4">
        <h3 className="font-bold text-orange-900 mb-2">📊 Your Stats</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <StatCard label="Total toots" value={getStats(kidId).totalTaps} />
          <StatCard label="Recordings" value={getStats(kidId).recordings} />
          <StatCard label="Combos" value={getStats(kidId).combosPlayed} />
          <StatCard label="Day streak" value={getStats(kidId).consecutiveDays} />
        </div>
      </div>
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
  adultMode,
  setAdultMode,
}: {
  parental: ParentalSettings;
  setParental: (s: ParentalSettings) => void;
  reverbMode: boolean;
  toggleReverb: () => void;
  showHypeMeter: boolean;
  setShowHypeMeter: (v: boolean) => void;
  adultMode: boolean;
  setAdultMode: (v: boolean) => void;
}) {
  const [local, setLocal] = useState(parental);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [pinGateOpen, setPinGateOpen] = useState(false);

  const requestNotif = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      const { subscribeToPush } = await import("./pwa");
      await subscribeToPush();
    }
  };

  const update = <K extends keyof ParentalSettings>(key: K, value: ParentalSettings[K]) => {
    const next = { ...local, [key]: value };
    setLocal(next);
    setParental(next);
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-1 text-center">👪 Grown-Up Settings</h2>
      <p className="text-sm text-slate-700/70 text-center mb-4">Quiet hours, daily limits, and more.</p>

      {/* Notification permission card */}
      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-800">🔔 Daily Challenge Reminder</div>
            <div className="text-xs text-slate-600">
              {notifPermission === "granted" ? "✅ Reminders enabled" :
               notifPermission === "denied" ? "❌ Blocked — change in browser settings" :
               "Tap to enable daily push reminders"}
            </div>
          </div>
          {notifPermission !== "granted" && notifPermission !== "denied" && (
            <button onClick={requestNotif} className="bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-bold active:scale-95">
              Enable
            </button>
          )}
        </div>
      </div>

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

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg mb-3">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔒</div>
          <div className="flex-1">
            <div className="font-bold text-slate-800">Adult mode</div>
            <div className="text-xs text-slate-600 mt-1">
              Tapping the lock turns on emoji reactions (👍 😂 💀) and "Find Friends" in the feed. Off is the default for kids.
            </div>
            <button
              onClick={() => setPinGateOpen(true)}
              className="mt-2 px-3 py-1.5 rounded-full bg-slate-800 text-white text-xs font-bold active:scale-95"
            >
              {adultMode ? "Change adult settings" : "Unlock adult mode"}
            </button>
            {adultMode && (
              <div className="mt-2 text-xs text-emerald-700 font-bold">✅ Adult mode is ON — react with 👍 😂 💀 on the feed</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-sm text-red-900">
        <h3 className="font-bold mb-2">📍 All data is stored on this device only</h3>
        <p>Recordings, stickers, and stats live in your browser's local storage. No data is sent to any server. Clearing your browser data will erase all recordings.</p>
      </div>

      <PinGate
        open={pinGateOpen}
        onClose={() => setPinGateOpen(false)}
        title="Parent PIN"
      >
        {(lockAndClose) => (
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer bg-slate-50 rounded-xl p-3 border border-slate-200">
              <input
                type="checkbox"
                checked={adultMode}
                onChange={(e) => setAdultMode(e.target.checked)}
                className="w-6 h-6 mt-0.5"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-800">👤 Adult mode</div>
                <div className="text-xs text-slate-600 mt-1">
                  Turns on emoji reactions and "Find Friends" on the feed.
                </div>
              </div>
            </label>
            <button
              onClick={lockAndClose}
              className="w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-bold active:scale-95"
            >
              Done
            </button>
          </div>
        )}
      </PinGate>
    </main>
  );
}

// === Explore Tab — moved to SocialTab ===
void 0; // (ExploreTab removed in v15; replaced by Instagram-style SocialTab)

// === Voice Tab — pick an animal, apply pitch/speed/reverb, layer, loop ===
function VoiceTabInline() {
  const [selectedId, setSelectedId] = useState("cow");
  const [pitch, setPitch] = useState(0); // semitones (-12 to +12)
  const [speed, setSpeed] = useState(1.0); // 0.4 to 2.0
  const [reverb, setReverb] = useState(0); // 0/1/2
  const [layerCount, setLayerCount] = useState(1); // 1=single, 2=double, 3=triple
  const [looper, setLooper] = useState(false);

  useEffect(() => {
    setPitchSemitones(pitch);
    setSpeedFactor(speed);
    setReverbAmount(reverb);
  }, [pitch, speed, reverb]);

  useEffect(() => {
    if (!looper) return;
    const id = setInterval(() => playSelected(), 1800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looper, selectedId, pitch, speed, reverb]);

  const playSelected = () => {
    const preset = PRESETS.find((p) => p.id === selectedId);
    if (!preset) return;
    const count = layerCount;
    for (let i = 0; i < count; i++) {
      setTimeout(() => playFart(preset), i * 90);
    }
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-amber-900 text-center mb-1">🎭 Funny Voice</h2>
      <p className="text-sm text-amber-800/80 text-center mb-3">Pick an animal, then make it high, low, slow, fast — or stack 3 at once!</p>

      {/* Source picker */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedId(p.id); playSelected(); }}
            className={`relative aspect-square rounded-2xl bg-gradient-to-br ${p.color} shadow-md border-4 active:scale-95 ${selectedId === p.id ? "border-amber-900 ring-2 ring-amber-900" : "border-white"}`}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl">{p.emoji}</div>
              <div className="text-[10px] font-bold text-amber-950 drop-shadow leading-tight mt-0.5">{p.name}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Play button + layer + looper */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={playSelected}
          className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-extrabold text-lg shadow-xl border-4 border-white active:scale-95"
        >
          ▶️ PLAY ({PRESETS.find(p=>p.id===selectedId)?.name || "—"})
        </button>
        <button
          onClick={() => setLooper((v) => !v)}
          className={`px-3 rounded-2xl font-bold border-2 ${looper ? "bg-rose-500 text-white border-rose-700 animate-pulse" : "bg-white/60 text-rose-600 border-rose-300"}`}
          title="Loop playback"
        >
          🔁
        </button>
      </div>

      {/* Sliders */}
      <div className="bg-white/80 rounded-2xl p-3 shadow-lg mb-3 space-y-3">
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
            <span>🎚️ Pitch</span>
            <span>{pitch > 0 ? "+" : ""}{pitch} st</span>
          </div>
          <input type="range" min="-12" max="12" step="1" value={pitch} onChange={(e) => setPitch(parseInt(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
            <span>⏱️ Speed</span>
            <span>{speed.toFixed(2)}x</span>
          </div>
          <input type="range" min="0.4" max="2.0" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
            <span>🌫️ Reverb</span>
            <span>{reverb === 0 ? "Dry" : reverb === 1 ? "Bathroom" : "Cave"}</span>
          </div>
          <div className="flex gap-1">
            {([0,1,2] as const).map((r) => (
              <button key={r} onClick={() => setReverb(r)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border-2 ${reverb===r ? "bg-amber-500 text-white border-amber-700" : "bg-white/60 text-slate-600 border-slate-200"}`}>
                {r===0 ? "🔈 Dry" : r===1 ? "🚿 Bath" : "🦇 Cave"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
            <span>📚 Layers (stacked)</span>
            <span>{layerCount}×</span>
          </div>
          <div className="flex gap-1">
            {([1,2,3] as const).map((n) => (
              <button key={n} onClick={() => setLayerCount(n)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border-2 ${layerCount===n ? "bg-amber-500 text-white border-amber-700" : "bg-white/60 text-slate-600 border-slate-200"}`}>
                {n}× {n === 1 ? "" : "stacked"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => { setPitch(0); setSpeed(1.0); setReverb(0); setLayerCount(1); setLooper(false); }}
        className="w-full py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm"
      >
        ↺ Reset
      </button>
    </main>
  );
}

// === Social Tab — Instagram-like soundboard ===
function SocialTab(props: {
  me: SocialUser | null;
  setMe: (u: SocialUser | null) => void;
  viewedUser: SocialUser | null;
  setViewedUser: (u: SocialUser) => void;
  socialView: "feed" | "discover" | "profile" | "viewProfile";
  setSocialView: (v: "feed" | "discover" | "profile" | "viewProfile") => void;
  editingProfile: boolean;
  setEditingProfile: (v: boolean) => void;
  activeKid: Kid | null;
  recordings: CustomRecording[];
  adultMode?: boolean;
}) {
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Load me + feed + discover on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [me, health, feed, users] = await Promise.all([
          getMe().catch(() => null),
          getHealth().catch(() => null),
          getFeed(),
          getUsers().catch(() => ({ users: [] })),
        ]);
        if (cancelled) return;
        props.setMe(me);
        setServerOnline(!!health);
        setGroups(feed.groups || []);
        setDiscoverUsers((users.users || []).filter((u) => !me || u.handle !== me.handle));
      } catch (err) {
        console.warn("[social] load failed:", err);
        setServerOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const [me, feed] = await Promise.all([getMe().catch(() => null), getFeed()]);
      props.setMe(me);
      setGroups(feed.groups || []);
    } catch (err) {
      console.warn("[social] refresh failed:", err);
    }
  };

  // React to new local recordings being posted to the feed (from any tab)
  useEffect(() => {
    const onFeedChanged = () => { refresh(); };
    window.addEventListener("animal-farts:feed-changed", onFeedChanged);
    return () => window.removeEventListener("animal-farts:feed-changed", onFeedChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
        <div className="text-center text-emerald-900/70 py-12">Loading…</div>
      </main>
    );
  }

  if (props.socialView === "profile" && props.me) {
    return <MyProfileView me={props.me} setMe={props.setMe} setSocialView={props.setSocialView} editingProfile={props.editingProfile} setEditingProfile={props.setEditingProfile} activeKid={props.activeKid} recordings={props.recordings} refresh={refresh} />;
  }
  if (props.socialView === "viewProfile" && props.viewedUser) {
    return <ViewProfileView viewedUser={props.viewedUser} setSocialView={props.setSocialView} me={props.me} refresh={refresh} />;
  }
  if (props.socialView === "discover") {
    return <DiscoverView users={discoverUsers} setViewedUser={props.setViewedUser} setSocialView={props.setSocialView} me={props.me} refresh={refresh} />;
  }
  return <FeedView groups={groups} serverOnline={serverOnline} setSocialView={props.setSocialView} setViewedUser={props.setViewedUser} me={props.me} refresh={refresh} adultMode={props.adultMode} />;
}

function FeedView(props: {
  groups: FeedGroup[];
  serverOnline: boolean | null;
  setSocialView: (v: "feed" | "discover" | "profile" | "viewProfile") => void;
  setViewedUser: (u: SocialUser) => void;
  me: SocialUser | null;
  refresh: () => void;
  adultMode?: boolean;
}) {
  const [commentingOn, setCommentingOn] = useState<number | null>(null);

  return (
    <main className="flex-1 pb-4 max-w-3xl mx-auto w-full">
      {/* Top bar: title + tabs */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-emerald-50 via-emerald-50 to-emerald-50/95 backdrop-blur border-b-2 border-emerald-200 px-3 py-2 flex items-center justify-between">
        <h2 className="text-xl font-bold text-emerald-900">🌍 Soundboard</h2>
        <div className="flex gap-1">
          {props.adultMode && (
            <button
              onClick={() => props.setSocialView("discover")}
              className="px-3 py-1.5 rounded-full bg-emerald-500 text-white font-bold text-xs active:scale-95"
            >
              🔍 Find Friends
            </button>
          )}
          <button
            onClick={() => props.setSocialView("profile")}
            className="px-3 py-1.5 rounded-full bg-white text-emerald-900 font-bold text-xs border-2 border-emerald-300 active:scale-95"
          >
            👤 {props.me?.displayName?.split(" ")[0] || "Me"}
          </button>
        </div>
      </div>

      {props.serverOnline === false && (
        <div className="m-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 text-amber-900 text-sm">
          📡 Sharing is offline right now. Pull to refresh once the server is back.
        </div>
      )}

      <div className="px-3 pt-3 space-y-4">
        {props.groups.length === 0 ? (
          <div className="text-center text-emerald-900/60 py-12">
            <div className="text-6xl mb-2">🎤</div>
            <p className="font-semibold">No farts yet</p>
            <p className="text-sm">Record one in <strong>My Farts</strong> to start the feed.</p>
          </div>
        ) : (
          props.groups.map((group) => (
            <FeedGroupCard
              key={group.author.handle}
              group={group}
              me={props.me}
              onViewProfile={() => { props.setViewedUser(group.author); props.setSocialView("viewProfile"); }}
              onComment={(id) => setCommentingOn(id)}
              onUpdate={props.refresh}
              adultMode={props.adultMode}
            />
          ))
        )}
      </div>

      {commentingOn !== null && (
        <CommentsModal recordingId={commentingOn} onClose={() => { setCommentingOn(null); props.refresh(); }} me={props.me} />
      )}
    </main>
  );
}

function FeedGroupCard(props: {
  group: FeedGroup;
  me: SocialUser | null;
  onViewProfile: () => void;
  onComment: (id: number) => void;
  onUpdate: () => void;
  adultMode?: boolean;
}) {
  const g = props.group;
  return (
    <article className="bg-white rounded-3xl shadow-md border-2 border-emerald-200 overflow-hidden">
      {/* Author header */}
      <button onClick={props.onViewProfile} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 active:scale-95">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">{g.author.avatar}</div>
        <div className="text-left flex-1">
          <div className="font-bold text-emerald-900 text-sm">{g.author.displayName}</div>
          <div className="text-[10px] text-emerald-700/70">@{g.author.handle} · {g.author.recordingCount} farts</div>
        </div>
        {props.me && !g.author.isMe && (
          <FollowButton user={g.author} onUpdate={props.onUpdate} me={props.me} />
        )}
      </button>
      {/* Recordings stack */}
      <div className="space-y-2 p-2">
        {g.recordings.map((r) => (
          <FeedRecordingCard key={r.id} rec={r} me={props.me} onComment={() => props.onComment(r.id)} onUpdate={props.onUpdate} adultMode={props.adultMode} />
        ))}
      </div>
    </article>
  );
}

function FeedRecordingCard(props: { rec: FeedRecording; me: SocialUser | null; onComment: () => void; onUpdate: () => void; adultMode?: boolean }) {
  const r = props.rec;
  const [voted, setVoted] = useState(r.userVoted);
  const [count, setCount] = useState(r.upvotes);
  const [showComment, setShowComment] = useState(false);
  const [busy, setBusy] = useState(false);
  // Adult-only emoji reactions (👍 😂 💀). Loaded lazily on mount.
  const [reactions, setReactions] = useState<{ counts: Record<string, number>; mine: string[] }>({ counts: {}, mine: [] });

  useEffect(() => {
    if (!props.adultMode) return;
    let cancelled = false;
    (async () => {
      const { getReactions } = await import("./audio/serverApi");
      if (cancelled) return;
      const data = await getReactions(r.id);
      if (!cancelled) setReactions(data);
    })();
    return () => { cancelled = true; };
  }, [r.id, props.adultMode]);

  const onVote = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { toggleUpvote } = await import("./audio/serverApi");
      const res = await toggleUpvote(r.id);
      setVoted(res.userVoted);
      setCount(res.upvotes);
    } catch (err) {
      console.warn("[feed] vote failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const onReact = async (emoji: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const { toggleReaction } = await import("./audio/serverApi");
      const data = await toggleReaction(r.id, emoji);
      setReactions(data);
    } catch (err) {
      console.warn("[feed] reaction failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-2 border border-emerald-200">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-2xl">{r.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-emerald-950 text-sm truncate">{r.name}</div>
          {r.kidName && <div className="text-[10px] text-emerald-700/70">by {r.kidName}</div>}
        </div>
        <button
          onClick={onVote}
          disabled={busy}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold active:scale-95 ${voted ? "bg-emerald-500 text-white" : "bg-white/80 text-emerald-700 border border-emerald-200"}`}
        >
          {voted ? "⭐" : "☆"} {count}
        </button>
      </div>
      <audio src={r.audioUrl} controls preload="none" className="w-full h-8" />
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {props.adultMode && (
          <button
            onClick={() => { setShowComment(true); props.onComment(); }}
            className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded-full bg-white/60 hover:bg-emerald-100"
          >
            💬 Comment
          </button>
        )}
        <button
          onClick={async () => {
            const { share } = await import("./pwa");
            await share({ title: `💨 ${r.name}`, text: `Check out "${r.name}" by ${r.author?.displayName || "Fart Fan"}`, url: window.location.origin + "/?action=viewProfile&user=" + r.author?.handle });
          }}
          className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded-full bg-white/60 hover:bg-emerald-100"
        >
          🔗 Share
        </button>
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            const { saveFeedRecordingToMyFarts } = await import("./audio/saveFromFeed");
            const saved = await saveFeedRecordingToMyFarts(r);
            setBusy(false);
            if (saved) {
              window.dispatchEvent(new CustomEvent("animal-farts:my-farts-changed"));
              alert(`💾 Saved "${saved.name}" to My Farts!`);
            } else {
              alert("Couldn't save right now — try again when you're online.");
            }
          }}
          disabled={busy}
          className="text-[10px] text-emerald-700 font-bold px-2 py-0.5 rounded-full bg-white/60 hover:bg-emerald-100 disabled:opacity-50"
        >
          💾 Save to my farts
        </button>
      </div>
      {props.adultMode && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {["👍", "😂", "💀"].map((emoji) => {
            const n = reactions.counts[emoji] || 0;
            const mine = reactions.mine.includes(emoji);
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                disabled={busy}
                aria-pressed={mine}
                className={`px-2 py-1 rounded-full text-base active:scale-90 transition select-none border ${mine ? "bg-emerald-200 border-emerald-500" : "bg-white/70 border-emerald-200 hover:bg-emerald-50"} disabled:opacity-50`}
                title={mine ? "Tap to remove" : "Tap to react"}
              >
                <span className="mr-1">{emoji}</span>
                {n > 0 && <span className="text-[10px] font-bold text-emerald-900">{n}</span>}
              </button>
            );
          })}
        </div>
      )}
      {showComment && (
        <CommentsModal recordingId={r.id} onClose={() => { setShowComment(false); props.onUpdate(); }} me={props.me} />
      )}
    </div>
  );
}

function FollowButton(props: { user: SocialUser; me: SocialUser; onUpdate: () => void }) {
  const [following, setFollowing] = useState(props.user.isFollowing);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await toggleFollow(props.user.handle);
      setFollowing(res.following);
      props.onUpdate();
    } catch (err) {
      console.warn("[social] follow failed:", err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`px-3 py-1 rounded-full text-xs font-bold active:scale-95 ${following ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-emerald-500 text-white"}`}
    >
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}

function CommentsModal(props: { recordingId: number; onClose: () => void; me: SocialUser | null }) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { comments } = await getComments(props.recordingId);
      setComments(comments);
    } catch (err) {
      console.warn("[comments] load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [props.recordingId]);

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(props.recordingId, body.trim());
      setBody("");
      await load();
    } catch (err: any) {
      alert(err.message || "Comment failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this comment?")) return;
    try { await deleteComment(id); await load(); } catch (err) { alert("Delete failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-emerald-200 flex items-center justify-between">
          <h3 className="font-bold text-emerald-900">💬 Comments</h3>
          <button onClick={props.onClose} className="text-emerald-700 font-bold px-2">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? <div className="text-center text-emerald-700/60 py-8">Loading…</div> :
            comments.length === 0 ? <div className="text-center text-emerald-700/60 py-8">No comments yet. Be the first!</div> :
            comments.map((c) => (
              <div key={c.id} className="bg-emerald-50 rounded-xl p-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-base">{c.author.avatar}</span>
                  <span className="font-bold text-emerald-900 text-sm">{c.author.displayName}</span>
                  <span className="text-[10px] text-emerald-700/60">@{c.author.handle}</span>
                  {props.me?.handle === c.author.handle && (
                    <button onClick={() => del(c.id)} className="ml-auto text-[10px] text-red-500 font-bold">delete</button>
                  )}
                </div>
                <p className="text-sm text-emerald-950">{c.body}</p>
              </div>
            ))
          }
        </div>
        {props.me && (
          <div className="border-t border-emerald-200 p-2 flex gap-2">
            <span className="text-2xl">{props.me.avatar}</span>
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              maxLength={280}
              placeholder="Say something nice…"
              className="flex-1 px-3 py-2 rounded-full border-2 border-emerald-300 focus:border-emerald-500 outline-none text-sm"
            />
            <button onClick={submit} disabled={busy || !body.trim()} className="px-3 py-2 rounded-full bg-emerald-500 text-white font-bold text-sm disabled:opacity-50">Post</button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverView(props: { users: SocialUser[]; setViewedUser: (u: SocialUser) => void; setSocialView: (v: "feed" | "discover" | "profile" | "viewProfile") => void; me: SocialUser | null; refresh: () => void }) {
  return (
    <main className="flex-1 pb-4 max-w-3xl mx-auto w-full">
      <div className="sticky top-0 z-30 bg-emerald-50 border-b-2 border-emerald-200 px-3 py-2 flex items-center gap-2">
        <button onClick={() => props.setSocialView("feed")} className="text-emerald-700 font-bold">←</button>
        <h2 className="text-xl font-bold text-emerald-900 flex-1">🔍 Discover</h2>
      </div>
      <div className="p-3 space-y-2">
        {props.users.length === 0 ? (
          <div className="text-center text-emerald-900/60 py-12">
            <div className="text-5xl mb-2">🌱</div>
            <p className="font-semibold">No friends yet</p>
            <p className="text-sm">You're the first one here. Record a fart and share it!</p>
          </div>
        ) : (
          props.users.map((u) => (
            <button
              key={u.handle}
              onClick={() => { props.setViewedUser(u); props.setSocialView("viewProfile"); }}
              className="w-full bg-white rounded-2xl shadow-sm border-2 border-emerald-200 p-3 flex items-center gap-3 active:scale-95 text-left"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">{u.avatar}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-emerald-900 truncate">{u.displayName}</div>
                <div className="text-xs text-emerald-700/70">@{u.handle}</div>
                <div className="text-[10px] text-emerald-700/50">{u.recordingCount} farts · {u.followerCount} followers</div>
              </div>
              {props.me && !u.isMe && <FollowButton user={u} me={props.me} onUpdate={props.refresh} />}
            </button>
          ))
        )}
      </div>
    </main>
  );
}

function MyProfileView(props: { me: SocialUser; setMe: (u: SocialUser) => void; setSocialView: (v: "feed" | "discover" | "profile" | "viewProfile") => void; editingProfile: boolean; setEditingProfile: (v: boolean) => void; activeKid: Kid | null; recordings: CustomRecording[]; refresh: () => void }) {
  const [recs, setRecs] = useState<FeedRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { recordings } = await getUserRecordings(props.me.handle);
        setRecs(recordings);
      } catch (err) { console.warn(err); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.me.handle]);

  if (props.editingProfile) {
    return <EditProfileView me={props.me} setMe={props.setMe} onClose={() => props.setEditingProfile(false)} />;
  }

  return (
    <main className="flex-1 pb-4 max-w-3xl mx-auto w-full">
      <div className="sticky top-0 z-30 bg-emerald-50 border-b-2 border-emerald-200 px-3 py-2 flex items-center gap-2">
        <button onClick={() => props.setSocialView("feed")} className="text-emerald-700 font-bold">←</button>
        <h2 className="text-xl font-bold text-emerald-900 flex-1">👤 My Profile</h2>
        <button onClick={() => props.setEditingProfile(true)} className="text-emerald-700 font-bold text-sm">Edit</button>
      </div>
      <div className="p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 border-b-2 border-emerald-200">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white border-4 border-emerald-300 flex items-center justify-center text-5xl shadow-md">{props.me.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-emerald-900 truncate">{props.me.displayName}</div>
            <div className="text-sm text-emerald-700/70">@{props.me.handle}</div>
          </div>
        </div>
        {props.me.bio && <p className="text-sm text-emerald-900 mt-2">{props.me.bio}</p>}
        <div className="flex gap-3 mt-3 text-emerald-900 text-sm">
          <span><b>{props.me.recordingCount}</b> farts</span>
          <span><b>{props.me.followerCount}</b> followers</span>
          <span><b>{props.me.followingCount}</b> following</span>
        </div>
      </div>
      <h3 className="font-bold text-emerald-900 px-3 pt-3 pb-1">My recordings</h3>
      {loading ? <div className="text-center text-emerald-700/60 py-8">Loading…</div> :
        recs.length === 0 ? <div className="text-center text-emerald-700/60 py-8">No recordings yet.</div> :
        <div className="px-3 space-y-2">
          {recs.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border-2 border-emerald-200 p-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-2xl">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-emerald-950 text-sm truncate">{r.name}</div>
                </div>
                <div className="text-xs text-emerald-700">⭐ {r.upvotes}</div>
              </div>
              <audio src={r.audioUrl} controls preload="none" className="w-full h-8" />
            </div>
          ))}
        </div>
      }
    </main>
  );
}

function EditProfileView(props: { me: SocialUser; setMe: (u: SocialUser) => void; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(props.me.displayName);
  const [handle, setHandle] = useState(props.me.handle);
  const [avatar, setAvatar] = useState(props.me.avatar);
  const [bio, setBio] = useState(props.me.bio || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const updated = await updateMe({ displayName, handle, avatar, bio });
      props.setMe(updated);
      props.onClose();
    } catch (e: any) { setErr(e.message || "Save failed"); }
    finally { setBusy(false); }
  };

  const AVATARS = ["🐱", "🐶", "🐰", "🐻", "🐼", "🦊", "🐯", "🦁", "🐸", "🐵", "🦄", "🐲", "🐨", "🐷", "🐮", "🐔", "🐧", "🐢", "🐬", "🦖"];

  return (
    <main className="flex-1 pb-4 max-w-3xl mx-auto w-full">
      <div className="sticky top-0 z-30 bg-emerald-50 border-b-2 border-emerald-200 px-3 py-2 flex items-center gap-2">
        <button onClick={props.onClose} className="text-emerald-700 font-bold">Cancel</button>
        <h2 className="text-xl font-bold text-emerald-900 flex-1 text-center">Edit Profile</h2>
        <button onClick={save} disabled={busy} className="text-emerald-700 font-bold disabled:opacity-50">Save</button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="text-xs font-bold text-emerald-700">Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} className="w-full px-3 py-2 rounded-xl border-2 border-emerald-300 focus:border-emerald-500 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-emerald-700">Handle (3-20 chars, lowercase letters/numbers/_)</label>
          <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} className="w-full px-3 py-2 rounded-xl border-2 border-emerald-300 focus:border-emerald-500 outline-none font-mono" />
        </div>
        <div>
          <label className="text-xs font-bold text-emerald-700">Avatar</label>
          <div className="grid grid-cols-10 gap-1">
            {AVATARS.map((a) => (
              <button key={a} onClick={() => setAvatar(a)} className={`text-2xl p-1 rounded-lg ${avatar === a ? "bg-emerald-200 ring-2 ring-emerald-500" : "hover:bg-emerald-100"}`}>{a}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-emerald-700">Bio (200 chars max)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} maxLength={200} className="w-full px-3 py-2 rounded-xl border-2 border-emerald-300 focus:border-emerald-500 outline-none h-20" />
        </div>
        {err && <div className="text-red-600 text-sm font-bold">{err}</div>}
      </div>
    </main>
  );
}

function ViewProfileView(props: { viewedUser: SocialUser; setSocialView: (v: "feed" | "discover" | "profile" | "viewProfile") => void; me: SocialUser | null; refresh: () => void }) {
  const u = props.viewedUser;
  const [recs, setRecs] = useState<FeedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { recordings } = await getUserRecordings(u.handle);
        setRecs(recordings);
      } catch (err) { console.warn(err); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.handle]);
  return (
    <main className="flex-1 pb-4 max-w-3xl mx-auto w-full">
      <div className="sticky top-0 z-30 bg-emerald-50 border-b-2 border-emerald-200 px-3 py-2 flex items-center gap-2">
        <button onClick={() => props.setSocialView("feed")} className="text-emerald-700 font-bold">←</button>
        <h2 className="text-xl font-bold text-emerald-900 flex-1">@{u.handle}</h2>
        {props.me && !u.isMe && <FollowButton user={u} me={props.me} onUpdate={props.refresh} />}
      </div>
      <div className="p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 border-b-2 border-emerald-200">
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-white border-4 border-emerald-300 flex items-center justify-center text-5xl shadow-md">{u.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-emerald-900 truncate">{u.displayName}</div>
            <div className="text-sm text-emerald-700/70">@{u.handle}</div>
          </div>
        </div>
        {u.bio && <p className="text-sm text-emerald-900 mt-2">{u.bio}</p>}
        <div className="flex gap-3 mt-3 text-emerald-900 text-sm">
          <span><b>{u.recordingCount}</b> farts</span>
          <span><b>{u.followerCount}</b> followers</span>
          <span><b>{u.followingCount}</b> following</span>
        </div>
      </div>
      <h3 className="font-bold text-emerald-900 px-3 pt-3 pb-1">Recordings</h3>
      {loading ? (
        <div className="text-center text-emerald-700/60 py-8">Loading…</div>
      ) : recs.length === 0 ? (
        <div className="text-center text-emerald-700/60 py-8">No recordings yet.</div>
      ) : (
        <div className="px-3 space-y-2">
          {recs.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border-2 border-emerald-200 p-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-2xl">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-emerald-950 text-sm truncate">{r.name}</div>
                </div>
                <div className="text-xs text-emerald-700">⭐ {r.upvotes}</div>
              </div>
              <audio src={r.audioUrl} controls preload="none" className="w-full h-8" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
