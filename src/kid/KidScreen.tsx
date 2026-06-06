// Poot Party — KidScreen. v26f.
// Profile picker home scene → scene loop (Farm → Jungle → ...).
// Supports multiple kid profiles with lastSceneId persistence.

import { useState, useCallback, useRef, useEffect } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { ThingTile } from './ThingTile';
import { HeardCountBadge } from './HeardCountBadge';
import { PinDropper } from './PinDropper';
import { PinTile } from './PinTile';
import { HomeScene } from './HomeScene';
import { useSoundEngine } from './useSoundEngine';
import { getKidStorage } from './useKidStorage';
import type { Pin, Profile } from './useKidStorage';
import { ConfettiBurst } from './ConfettiBurst';
import { MilestoneBanner } from './MilestoneBanner';

// The "real" scenes that rotate (exclude home)
const REAL_SCENES = SCENES.filter(s => s.id !== 'home');
const REAL_SCENE_COUNT = REAL_SCENES.length;
const SWIPE_THRESHOLD = 50; // px
const AUTO_ROTATE_MS = 30_000; // 30 seconds
const LONG_PRESS_MS = 500; // ms threshold for empty-area pin drop
const BAND_CHAIN_WINDOW_MS = 1500; // 1.5s window for 3-tap band
const BAND_PLAY_GAP_MS = 300; // gap between queued sounds
const MILESTONES = [10, 25, 50, 100, 200];
const SHAKE_THRESHOLD = 15; // m/s²

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
  const [shakeJitter, setShakeJitter] = useState(false);
  const [musicNotes, setMusicNotes] = useState<MusicNote[]>([]);

  const { playRandom, stopAll, isRecording } = useSoundEngine();
  const storage = getKidStorage();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent taps for band chain detection
  const recentTapsRef = useRef<{ time: number; sound: string; x: number; y: number }[]>([]);
  const noteIdRef = useRef(0);
  const milestoneSeenRef = useRef<Set<number>>(new Set()); // track milestones already fired

  // Show home on mount
  useEffect(() => {
    setCurrentSceneIndex(0);
    setActiveProfile(null);
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

  const onTapThing = useCallback((thing: Thing, tapX: number, tapY: number) => {
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
      setTimeout(() => setBandBannerVisible(false), 1000);
      playQueuedBand(bandTaps);
    } else {
      // Normal single tap
      playRandom(sound);
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

  // === Shake-to-shuffle ===
  useEffect(() => {
    if (!activeProfile) return;
    const scene = SCENES[currentSceneIndex];
    if (scene.id === 'home') return;

    let lastShakeTime = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt(
        (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
      );
      const now = Date.now();
      // Debounce: only fire if > 500ms since last shake
      if (mag > SHAKE_THRESHOLD && now - lastShakeTime > 500) {
        lastShakeTime = now;
        setShakeJitter(true);
        if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = setTimeout(() => {
          setShakeJitter(false);
        }, 600);
      }
    };

    // iOS 13+ requires a user gesture before devicemotion fires
    // The first tap counts as the gesture; we add the listener on mount
    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    };
  }, [activeProfile, currentSceneIndex]);

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

      <SceneBackground bg={scene.bg} sceneKey={scene.id}>
        {pins.map(pin => (
          <PinTile key={pin.id} pin={pin} onDelete={onPinDelete} />
        ))}

        {scene.things.map((thing, i) => (
          <ThingTile
            key={`${scene.id}-${thing.id}`}
            thing={thing}
            index={i}
            onTap={(_thing, e) => {
              const x = e ? e.clientX : window.innerWidth / 2;
              const y = e ? e.clientY : window.innerHeight / 2;
              onTapThing(thing, x, y);
            }}
            shakeJitter={shakeJitter}
          />
        ))}
        <HeardCountBadge count={heardCount} />
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

      {/* Scene dot indicator */}
      <div style={{
        position: 'fixed',
        bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
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
        {REAL_SCENES.map((_, i) => (
          <button
            key={i}
            onClick={() => onDotTap(i)}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === realSceneIndex ? '#fff' : 'rgba(255,255,255,0.45)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              transition: 'background 200ms, transform 200ms',
              transform: i === realSceneIndex ? 'scale(1.25)' : 'scale(1)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              pointerEvents: 'auto',
            }}
          />
        ))}
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
    </div>
  );
}
