// Poot Party — KidScreen. v26f.
// Profile picker home scene → scene loop (Farm → Jungle → ...).
// Supports multiple kid profiles with lastSceneId persistence.

import { useState, useCallback, useRef, useEffect } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { RecordingThing } from './RecordingThing';
import { HeardCountBadge } from './HeardCountBadge';
import { FirstTapHint } from './FirstTapHint';
import { PinDropper } from './PinDropper';
import { PinTile } from './PinTile';
import { HomeScene } from './HomeScene';
import { useSoundEngine } from './useSoundEngine';
import { getKidStorage } from './useKidStorage';
import type { Pin, Profile } from './useKidStorage';
import { ConfettiBurst } from './ConfettiBurst';
import { MilestoneBanner } from './MilestoneBanner';
import { injectKeyframes } from './reactions';
import { PootPartyTV } from './PootPartyTV';
injectKeyframes();

const PARENT_SETTINGS_KEY = 'poot-party-parent-settings';

// The "real" scenes that rotate (exclude home)
const REAL_SCENES = SCENES.filter(s => s.id !== 'home');
const REAL_SCENE_COUNT = REAL_SCENES.length;
const SWIPE_THRESHOLD = 50; // px
const AUTO_ROTATE_MS = 30_000; // 30 seconds
const LONG_PRESS_MS = 500; // ms threshold for empty-area pin drop
const BAND_CHAIN_WINDOW_MS = 1500; // 1.5s window for 3-tap band
const BAND_PLAY_GAP_MS = 300; // gap between queued sounds
const MILESTONES = [10, 25, 50, 100, 200];

// Map from real scene index to SCENES index (accounting for home at index 0)
function realIndexToSceneIndex(realIndex: number): number {
  return realIndex + 1;
}

function sceneIdToSceneIndex(sceneId: string): number {
  const idx = SCENES.findIndex(s => s.id === sceneId);
  return idx === -1 ? 1 : idx;
}

// Music note for band chain
interface MusicNote {
  id: number;
  x: number;
  y: number;
}

export default function KidScreen() {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [heardCount, setHeardCount] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);

  // === Surprise interaction state ===
  const [bandBannerVisible, setBandBannerVisible] = useState(false);
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [musicNotes, setMusicNotes] = useState<MusicNote[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);
  const [shakeJitter, setShakeJitter] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [tvModeEnabled, setTvModeEnabled] = useState(false); // from parent settings

  const { playRandom, stopAll, isRecording } = useSoundEngine();
  const storage = getKidStorage();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Recent taps for band chain detection
  const recentTapsRef = useRef<{ time: number; sound: string; x: number; y: number }[]>([]);
  const noteIdRef = useRef(0);
  const milestoneSeenRef = useRef<Set<number>>(new Set()); // track milestones already fired

  // Shake-to-shuffle: listen for device motion on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const magnitude = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      if (magnitude > 20) {
        setShakeJitter(true);
        setTimeout(() => setShakeJitter(false), 600);
      }
    };
    window.addEventListener('devicemotion', handler);
    return () => {
      window.removeEventListener('devicemotion', handler);
    };
  }, []);

  // Show home on mount
  useEffect(() => {
    setCurrentSceneIndex(0);
    setActiveProfile(null);
  }, []);

  // Read tvModeEnabled from parent settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PARENT_SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setTvModeEnabled(!!s.tvModeEnabled);
      }
    } catch { /* ignore */ }
  }, []);

  // Load heard count when profile changes
  useEffect(() => {
    if (!activeProfile) return;
    void storage.getHeardCount(activeProfile.id).then(setHeardCount);
    // Reset milestone tracking on profile switch
    milestoneSeenRef.current = new Set();
  }, [activeProfile, storage]);

  // Load pins whenever scene changes
  useEffect(() => {
    if (!activeProfile) return;
    const scene = SCENES[currentSceneIndex];
    if (scene.id === 'home') return;
    void storage.getPins(scene.id, activeProfile.id).then(setPins);
  }, [currentSceneIndex, activeProfile, storage]);

  // Pause auto-rotate while recording
  useEffect(() => {
    if (isRecording()) {
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      resetTimer();
    }
  }, [isRecording]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSceneIndex]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (SCENES[currentSceneIndex]?.id === 'home') return;
    timerRef.current = setTimeout(() => {
      advanceScene(1);
    }, AUTO_ROTATE_MS);
  }, [currentSceneIndex]);

  const advanceScene = useCallback((delta: number) => {
    if (!activeProfile) return;
    const currentRealIndex = currentSceneIndex - 1;
    const newRealIndex = (currentRealIndex + delta + REAL_SCENE_COUNT) % REAL_SCENE_COUNT;
    setCurrentSceneIndex(realIndexToSceneIndex(newRealIndex));
    void storage.updateProfile({ ...activeProfile, lastSceneId: REAL_SCENES[newRealIndex].id });
  }, [currentSceneIndex, activeProfile, storage]);

  const handleSelectProfile = useCallback(async (profile: Profile) => {
    await storage.saveProfile(profile);
    setActiveProfile(profile);
    // Show welcome message
    setShowWelcome(true);
    setTimeout(() => setShowWelcome(false), 1500);
    const startSceneId = profile.lastSceneId && profile.lastSceneId !== 'home'
      ? profile.lastSceneId
      : 'farm';
    const startIndex = sceneIdToSceneIndex(startSceneId);
    setCurrentSceneIndex(startIndex);
    const scene = SCENES[startIndex];
    const pins = await storage.getPins(scene.id, profile.id);
    setPins(pins);
    const count = await storage.getHeardCount(profile.id);
    setHeardCount(count);
  }, [storage]);

  // === Band chain logic ===
  const playQueuedBand = useCallback((taps: { time: number; sound: string; x: number; y: number }[]) => {
    taps.forEach((tap, i) => {
      setTimeout(() => {
        stopAll();
        playRandom(tap.sound);
        // Spawn floating music note at tap location
        const id = ++noteIdRef.current;
        setMusicNotes(prev => [...prev, { id, x: tap.x, y: tap.y }]);
        // Remove note after animation
        setTimeout(() => {
          setMusicNotes(prev => prev.filter(n => n.id !== id));
        }, 800);
      }, i * BAND_PLAY_GAP_MS);
    });
  }, [playRandom, stopAll]);

  // onTapThing: called when a thing is tapped. If skipSound is true (used when
  // a kid recording was already played via onPlayKidRecording), skips the default
  // sound playback since the callback already handled it.
  const onTapThing = useCallback((thing: Thing, tapX: number, tapY: number, skipSound = false) => {
    resetTimer();
    stopAll();
    const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
    const now = Date.now();

    // Record this tap
    recentTapsRef.current.push({ time: now, sound, x: tapX, y: tapY });

    // Keep only taps within the window
    recentTapsRef.current = recentTapsRef.current.filter(t => now - t.time< BAND_CHAIN_WINDOW_MS);

    const taps = recentTapsRef.current;

    if (taps.length >= 3) {
      // It's a band! Queue the sounds, clear the ref, show banner
      const bandTaps = [...taps];
      recentTapsRef.current = [];
      setBandBannerVisible(true);
      setTimeout(() => setBandBannerVisible(false), 1800); // 3 sounds × 300ms + music note fade
      playQueuedBand(bandTaps);
    } else {
      // Normal single tap — skipSound means a kid recording was already played
      if (!skipSound) playRandom(sound);
    }

    // Update count via functional update to always get latest state
    setHeardCount(prev => {
      const newCount = prev + 1;
      if (activeProfile) {
        void storage.markHeard(sound, activeProfile.id);
      }
      const crossed = MILESTONES.find(m => newCount >= m && !milestoneSeenRef.current.has(m));
      if (crossed !== undefined) {
        milestoneSeenRef.current.add(crossed);
        setMilestoneCount(crossed);
        setConfettiVisible(true);
      }
      return newCount;
    });
  }, [playRandom, stopAll, resetTimer, playQueuedBand, activeProfile, storage]);

  // Swipe handling
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = e.clientX;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartRef.current === null) return;
    if (!activeProfile) return;
    const delta = e.clientX - pointerStartRef.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      resetTimer();
      pointerStartRef.current = null;
      return;
    }
    if (delta < 0) {
      advanceScene(1);
    } else {
      advanceScene(-1);
    }
    pointerStartRef.current = null;
    resetTimer();
  }, [resetTimer, activeProfile, advanceScene]);

  const onDotTap = useCallback((realIndex: number) => {
    if (!activeProfile) return;
    setCurrentSceneIndex(realIndexToSceneIndex(realIndex));
    void storage.updateProfile({ ...activeProfile, lastSceneId: REAL_SCENES[realIndex].id });
    resetTimer();
  }, [activeProfile, storage, resetTimer]);

  // Long-press detection
  const onScenePointerDown = useCallback((e: React.PointerEvent) => {
    if (!activeProfile) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setPendingPinPos({ x, y });
    }, LONG_PRESS_MS);
  }, [activeProfile]);

  const onScenePointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPinSave = useCallback((pin: Pin) => {
    setPins(prev => [...prev, pin]);
    setPendingPinPos(null);
  }, []);

  const onPinCancel = useCallback(() => {
    setPendingPinPos(null);
  }, []);

  const onPinDelete = useCallback((id: string) => {
    storage.deletePin(id).then(() => {
      setPins(prev => prev.filter(p => p.id !== id));
    });
  }, [storage]);

  // If no profile is active, show the Home scene
  if (!activeProfile) {
    return (
      <div
        style={{ width: '100vw', height: '100vh', position: 'relative', userSelect: 'none', touchAction: 'none' }}
      >
        <HomeScene onSelectProfile={handleSelectProfile} />
      </div>
    );
  }

  const scene = SCENES[currentSceneIndex];
  const realSceneIndex = currentSceneIndex - 1;

  return (
<div
      style={{ width: '100vw', height: '100vh', position: 'relative', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Long-press detector */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
        }}
        onPointerDown={onScenePointerDown}
        onPointerUp={onScenePointerUp}
      />

      {/* Welcome banner */}
      {showWelcome && activeProfile && (
        <div
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99990,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            borderRadius: '999px',
            padding: '10px 22px',
            fontSize: 'clamp(1rem, 4vw, 1.4rem)',
            fontWeight: 700,
            fontFamily: 'Fredoka, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            animation: 'welcome-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          👋 Welcome back, {activeProfile.name}!
        </div>
      )}

      <SceneBackground bg={scene.bg} sceneKey={scene.id}>
        {pins.map(pin => (
          <PinTile key={pin.id} pin={pin} onDelete={onPinDelete} />
        ))}

        {scene.things.map((thing, i) => (
          <RecordingThing
            key={`${scene.id}-${thing.id}`}
            thing={thing}
            sceneId={scene.id}
            profileId={activeProfile?.id ?? 'default'}
            index={i}
            wobbleOffset={i * 200}
            shakeJitter={shakeJitter}
            onPlayKidRecording={(url, t) => {
              stopAll();
              playRandom(url);
              setHeardCount(c => c + 1);
              // Get tap coordinates from the button element
              const x = window.innerWidth / 2;
              const y = window.innerHeight / 2;
              // Pass skipSound=true so onTapThing doesn't double-play the sound
              onTapThing(t, x, y, true);
            }}
          >
            <span className="block w-full h-full flex items-center justify-center text-6xl sm:text-7xl drop-shadow-lg select-none">
              {thing.emoji}
            </span>
          </RecordingThing>
        ))}
        <HeardCountBadge count={heardCount} />
        <FirstTapHint />
      </SceneBackground>

      {/* Floating music notes (band chain) */}
      {musicNotes.map(note => (
<span
          key={note.id}
          className="music-note-float"
          style={{
            position: 'fixed',
            top: note.y,
            left: note.x,
            fontSize: '1.8rem',
            pointerEvents: 'none',
            zIndex: 99997,
          }}
        >
          🎵
        </span>
      ))}

      {/* Band chain banner */}
      {bandBannerVisible && (
        <div
          className="band-banner"
          style={{
            position: 'fixed',
            bottom: 'max(48px, env(safe-area-inset-bottom, 48px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99996,
            pointerEvents: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            borderRadius: '1rem',
            padding: '0.4rem 1.2rem',
            fontSize: 'clamp(0.9rem, 4vw, 1.4rem)',
            fontWeight: 700,
            fontFamily: 'Fredoka, system-ui, sans-serif',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          🎵 Band! 🎵
        </div>
      )}

      {/* Milestone banner */}
      {milestoneCount !== null && (
        <MilestoneBanner
          count={milestoneCount}
          onComplete={() => setMilestoneCount(null)}
        />
      )}

      {/* Confetti burst */}
      {confettiVisible && (
        <ConfettiBurst onComplete={() => setConfettiVisible(false)} />
      )}

      {/* Scene emoji indicator — replaces plain dots with recognizable emoji */}
<div style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 6,
        pointerEvents: 'none',
        zIndex: 9999,
        padding: '6px 12px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.18)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        width: 'fit-content',
        margin: '0 auto',
      }}>
        {REAL_SCENES.map((s, i) => {
          const emoji = s.things[0]?.emoji ?? '📍';
          return (
            <button
              key={i}
              onClick={() => onDotTap(i)}
              style={{
                width: i === realSceneIndex ? 36 : 28,
                height: i === realSceneIndex ? 36 : 28,
                borderRadius: 10,
                background: i === realSceneIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                boxShadow: i === realSceneIndex
                  ? '0 2px 8px rgba(0,0,0,0.4),0 0 0 2px rgba(255,255,255,0.6)'
                  : '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: i === realSceneIndex ? 'scale(1.1)' : 'scale(1)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: i === realSceneIndex ? '1.2rem' : '1rem',
              }}
              aria-label={s.name}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      {/* Pin dropper modal */}
      {pendingPinPos !== null && (
        <PinDropper
          x={pendingPinPos.x}
          y={pendingPinPos.y}
          sceneId={scene.id}
          profileId={activeProfile.id}
          onSave={onPinSave}
          onCancel={onPinCancel}
        />
      )}

      {/* Poot Party TV — full-screen auto-play mode */}
      <PootPartyTV tvModeEnabled={tvMode && tvModeEnabled} onExit={() => setTvMode(false)} />

      {/* TV mode entry button — top right (only shown when parent enabled) */}
      {tvModeEnabled && (
        <button
          onClick={() => setTvMode(true)}
          style={{
            position: 'fixed',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.4)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          aria-label="Poot Party TV"
        >
          📺
        </button>
      )}
    </div>
  );
}
