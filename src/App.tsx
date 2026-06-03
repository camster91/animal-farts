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
  setReverbMode,
  stopAllSounds,
  playBlobWithFx,
  type FartPreset,
  type CustomRecording,
} from "./audio/fartEngine";
import {
  listRecordings as fetchSharedRecordings,
  uploadCustomRecording,
  toggleUpvote,
  deleteSharedRecording,
  getHealth,
  type SharedRecording,
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

type Poof = { id: number; x: number; y: number; emoji: string };
type Tab = "play" | "explore" | "mystuff" | "parental";

const HYPE_LABELS = [
  "Calm wind", "Whisper toot", "Solid rip", "HILARIOUS rip",
  "ROOM-CLEARER", "EVACUATE THE PREMISES",
];
const EMOJI_RAIN = ["💨", "💥", "🌪️", "💦", "🌀", "✨"];

export default function App() {
  const [tab, setTab] = useState<Tab>("play");
  const [profiles, setProfiles] = useState<Kid[]>([]);
  const [activeKid, setActiveKidState] = useState<Kid | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showKidMenu, setShowKidMenu] = useState(false);
  const [poofs, setPoofs] = useState<Poof[]>([]);
  const [shake, setShake] = useState(false);
  const [hype, setHype] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<CustomRecording[]>([]);
  const [reverbMode, setReverbModeState] = useState(false);
  const [showHypeMeter, setShowHypeMeter] = useState(false); // off by default — less noise for kids
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<{ url: string; duration: number; blob: Blob } | null>(null);
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmoji, setNewRecEmoji] = useState("💨");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [parental, setParental] = useState<ParentalSettings>(loadParentalSettings());
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
      if (preset.id.startsWith("ohno")) {
        updateStats(activeKid.id, (s) => ({ ...s, ohNoPlayed: s.ohNoPlayed + 1 }));
      }
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
    } else if (preset.id.startsWith("ohno")) {
      setPetState("shocked");
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

  const onSaveRecording = useCallback(() => {
    if (!pendingRecording) return;
    const rec = saveRecording({
      name: newRecName || "My Fart",
      emoji: newRecEmoji,
      url: pendingRecording.url,
    });
    setRecordings([...recordings, rec]);
    if (activeKid) {
      incrementTodayRecordings();
      updateStats(activeKid.id, (s) => ({
        ...s,
        recordings: s.recordings + 1,
        longestRecordingSec: Math.max(s.longestRecordingSec, pendingRecording.duration),
      }));
      // Daily challenge
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

  const onDeleteRecording = useCallback((id: string) => {
    if (!confirm("Delete this recording?")) return;
    deleteRecording(id);
    setRecordings(recordings.filter((r) => r.id !== id));
  }, [recordings]);

  const onPlayCustom = useCallback(async (rec: CustomRecording) => {
    try {
      const resp = await fetch(rec.url);
      const blob = await resp.blob();
      const withReverb = !!(window as any).__reverbEnabled;
      await playBlobWithFx(blob, withReverb);
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
            ohnoPresets={OHNO_PRESETS}
            recordings={recordings}
            activeKid={activeKid}
            trigger={trigger}
            active={active}
            onPlayCustom={onPlayCustom}
            onDeleteRecording={onDeleteRecording}
            onStartRecord={onStartRecord}
            onStopRecord={onStopRecord}
            onSaveRecording={onSaveRecording}
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

      {tab === "explore" && <ExploreTab activeKid={activeKid} recordings={recordings} />}

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
        </footer>
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
  ohnoPresets: FartPreset[];
  recordings: CustomRecording[];
  activeKid: Kid | null;
  trigger: (p: FartPreset, e?: React.MouseEvent | React.TouchEvent) => void;
  active: string | null;
  onPlayCustom: (rec: CustomRecording) => void;
  onDeleteRecording: (id: string) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onSaveRecording: () => void;
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
  const [sub, setSub] = useState<"animals" | "ohnos" | "myfarts">("animals");
  const EMOJI_CHOICES = ["💨", "🎤", "🤪", "😈", "👻", "👽", "💀", "🤡", "🦄", "🐸", "🐵", "🐷", "🐮", "🐔", "🐧", "🐢", "🐬", "🦖"];

  return (
    <>
      {/* Sub-tab bar — segmented control style, clearly secondary to main nav */}
      <div className="px-3 pb-3 max-w-3xl mx-auto w-full">
        <div className="bg-white/50 backdrop-blur rounded-full p-1 flex gap-0.5 border border-amber-200/50">
          {[
            { id: "animals" as const, label: "🐾 Animals" },
            { id: "ohnos" as const, label: "😱 Oh No!" },
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

      <main className="flex-1 px-3 pb-32">
        {sub === "myfarts" ? (
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
                  <div key={rec.id} className="relative aspect-square rounded-3xl bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 shadow-xl border-4 border-white">
                    <button
                      onClick={() => props.onPlayCustom(rec)}
                      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2 active:scale-95 transition-transform"
                    >
                      <div className="text-5xl sm:text-6xl">{rec.emoji}</div>
                      <div className="mt-1 text-sm sm:text-base font-bold text-purple-950 truncate max-w-full">{rec.name}</div>
                      <div className="text-[10px] font-semibold text-purple-900/80">{rec.id.toUpperCase()}</div>
                    </button>
                    <button
                      onClick={() => props.onDeleteRecording(rec.id)}
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
            {(sub === "ohnos" ? props.ohnoPresets : props.presets).map((p) => (
              <button
                key={p.id}
                onPointerDown={(e) => props.trigger(p, e)}
                onClick={(e) => { if (props.active !== p.id) props.trigger(p, e); }}
                className={`relative aspect-square rounded-3xl bg-gradient-to-br ${p.color} shadow-xl border-4 border-white/70 active:scale-95 transition-transform ${props.active === p.id ? "scale-95" : ""}`}
              >
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-2`}>
                  <div className={`text-5xl sm:text-6xl ${props.active === p.id ? "animate-wiggle" : ""}`}>{p.emoji}</div>
                  <div className="mt-1 text-sm sm:text-base font-bold text-amber-950 drop-shadow truncate max-w-full">{p.name}</div>
                  <div className="text-[9px] sm:text-[10px] font-semibold text-amber-900/80 uppercase tracking-wider truncate max-w-full">{p.caption}</div>
                </div>
              </button>
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
                <div className="flex gap-2">
                  <button
                    onClick={() => { if (props.pendingRecording) URL.revokeObjectURL(props.pendingRecording.url); props.setPendingRecording(null); }}
                    className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold"
                  >
                    Discard
                  </button>
                  <button
                    onClick={props.onSaveRecording}
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
      case "mostUniqueAnimals": return `${value}/${PRESETS.length + OHNO_PRESETS.length} animals`;
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

function ParentalTab({ parental, setParental, reverbMode, toggleReverb, showHypeMeter, setShowHypeMeter }: { parental: ParentalSettings; setParental: (s: ParentalSettings) => void; reverbMode: boolean; toggleReverb: () => void; showHypeMeter: boolean; setShowHypeMeter: (v: boolean) => void }) {
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
        <p>Recordings, stickers, and stats live in your browser's local storage. No data is sent to any server. Clearing your browser data will erase all recordings.</p>
      </div>
    </main>
  );
}

// === Explore Tab — shared server recordings ===
function ExploreTab({ activeKid, recordings }: { activeKid: Kid | null; recordings: CustomRecording[] }) {
  const [shared, setShared] = useState<SharedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<"top" | "new">("top");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [health, list] = await Promise.all([
      getHealth().catch(() => null),
      fetchSharedRecordings(),
    ]);
    setServerOnline(!!health);
    setShared(list.recordings.sort((a, b) => filter === "top" ? b.upvotes - a.upvotes : b.createdAt - a.createdAt));
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onUpvote = async (id: number) => {
    const result = await toggleUpvote(id);
    if (result) {
      setShared((prev) => prev.map((r) => r.id === id ? { ...r, upvotes: result.upvotes, userVoted: result.userVoted } : r).sort((a, b) => filter === "top" ? b.upvotes - a.upvotes : b.createdAt - a.createdAt));
    }
  };

  const onPlayShared = async (rec: SharedRecording & { _localBlobUrl?: string }) => {
    try {
      let blob: Blob;
      if (rec._localBlobUrl) {
        const resp = await fetch(rec._localBlobUrl);
        blob = await resp.blob();
      } else {
        const resp = await fetch(rec.audioUrl);
        blob = await resp.blob();
      }
      const withReverb = !!(window as any).__reverbEnabled;
      await playBlobWithFx(blob, withReverb);
    } catch (err) {
      console.warn("[explore] play failed:", err);
    }
  };

  const onShare = async (rec: CustomRecording) => {
    if (!serverOnline) {
      alert("Server is offline. Ask a grown-up to start it.");
      return;
    }
    setUploadingId(rec.id);
    try {
      await uploadCustomRecording(rec, activeKid?.name);
      await load();
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    } finally {
      setUploadingId(null);
    }
  };

  const onDeleteShared = async (id: number) => {
    if (!confirm("Delete this shared recording? Everyone will lose it.")) return;
    try {
      await deleteSharedRecording(id);
      setShared((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  };

  return (
    <main className="flex-1 px-3 pb-4 max-w-3xl mx-auto w-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-2xl font-bold text-emerald-900">🌍 Shared Farts</h2>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${serverOnline === null ? "bg-gray-400" : serverOnline ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs text-gray-600">{serverOnline === null ? "checking" : serverOnline ? "online" : "offline"}</span>
        </div>
      </div>

      {/* Share your recordings */}
      {recordings.length > 0 && (
        <div className="bg-white/60 rounded-2xl p-3 mb-4">
          <h3 className="font-bold text-sm text-gray-800 mb-2">📤 Share your recordings</h3>
          <div className="flex flex-wrap gap-2">
            {recordings.map((r) => (
              <button
                key={r.id}
                onClick={() => onShare(r)}
                disabled={uploadingId === r.id}
                className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 rounded-full text-sm font-bold text-emerald-900 active:scale-95 disabled:opacity-50"
              >
                {uploadingId === r.id ? "⏳" : "☁️"} {r.emoji} {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => { setFilter("top"); }}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${filter === "top" ? "bg-emerald-500 text-white" : "bg-white/60 text-gray-700"}`}
        >
          🏆 Top
        </button>
        <button
          onClick={() => { setFilter("new"); }}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${filter === "new" ? "bg-emerald-500 text-white" : "bg-white/60 text-gray-700"}`}
        >
          ✨ New
        </button>
        <button onClick={load} className="ml-auto px-3 py-1.5 rounded-full text-sm bg-white/60 text-gray-700">🔄</button>
      </div>

      {serverOnline === false && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center text-amber-900">
          <div className="text-3xl mb-2">📡</div>
          <p className="font-bold">Sharing is offline right now</p>
          <p className="text-sm mt-1">
            No internet? No problem — you can still play your own recordings below.
          </p>
        </div>
      )}

      {/* Local-only fallback: kid's own recordings + animal highlights */}
      {serverOnline === false && recordings.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold text-emerald-900 text-sm mb-2">🎤 Your recordings</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recordings.map((rec) => (
              <button
                key={rec.id}
                onClick={() => onPlayShared({
                  id: -1,
                  audioUrl: "",
                  emoji: rec.emoji,
                  name: rec.name,
                  kidName: activeKid?.name,
                  upvotes: 0,
                  createdAt: 0,
                  userVoted: false,
                  _localBlobUrl: rec.url,
                } as any)}
                className="bg-gradient-to-br from-emerald-100 to-teal-200 rounded-2xl p-3 shadow-md border-2 border-white/70 active:scale-95 transition-transform"
              >
                <div className="text-4xl mb-1">{rec.emoji}</div>
                <div className="text-sm font-bold text-emerald-950 truncate">{rec.name}</div>
                {activeKid && (
                  <div className="text-[10px] text-emerald-700/80">by {activeKid.name}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && serverOnline !== false && (
        <div className="text-center text-gray-500 py-8">Loading shared farts...</div>
      )}

      {!loading && serverOnline !== false && shared.length === 0 && (
        <div className="text-center text-emerald-900/60 py-8">
          <div className="text-4xl mb-2">🦗</div>
          <p className="font-semibold">No shared farts yet</p>
          <p className="text-sm">Be the first to share one above!</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {shared.map((rec) => (
          <div key={rec.id} className="bg-gradient-to-br from-emerald-100 to-teal-200 rounded-2xl p-3 shadow-md border-2 border-white/70 relative">
            <button
              onClick={() => onPlayShared(rec)}
              className="w-full active:scale-95 transition-transform"
            >
              <div className="text-4xl mb-1">{rec.emoji}</div>
              <div className="text-sm font-bold text-emerald-950 truncate">{rec.name}</div>
              {rec.kidName && (
                <div className="text-[10px] text-emerald-700/80">by {rec.kidName}</div>
              )}
            </button>
            <button
              onClick={() => onUpvote(rec.id)}
              className={`mt-2 w-full text-xs font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 ${rec.userVoted ? "bg-emerald-500 text-white" : "bg-white/80 text-emerald-700"}`}
            >
              {rec.userVoted ? "⭐" : "☆"} {rec.upvotes}
            </button>
            <button
              onClick={() => onDeleteShared(rec.id)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow active:scale-90"
              title="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
