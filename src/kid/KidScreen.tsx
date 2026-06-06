// Poot Party — KidScreen. v26d.
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

// The "real" scenes that rotate (exclude home)
const REAL_SCENES = SCENES.filter(s => s.id !== 'home');
const REAL_SCENE_COUNT = REAL_SCENES.length;
const SWIPE_THRESHOLD = 50; // px
const AUTO_ROTATE_MS = 30_000; // 30 seconds
const LONG_PRESS_MS = 500; // ms threshold for empty-area pin drop

// Map from real scene index to SCENES index (accounting for home at index 0)
function realIndexToSceneIndex(realIndex: number): number {
  // SCENES[0] = home, so realIndex 0 → SCENES index 1, etc.
  return realIndex + 1;
}

// Find the SCENES index for a given scene id (or 1 for farm if not found)
function sceneIdToSceneIndex(sceneId: string): number {
  const idx = SCENES.findIndex(s => s.id === sceneId);
  return idx === -1 ? 1 : idx; // default to farm (index 1)
}

export default function KidScreen() {
  // null profile → show HomeScene; set → show scene loop
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  // currentSceneIndex is always a SCENES index (0 = home, 1 = farm, etc.)
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [heardCount, setHeardCount] = useState(0);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pendingPinPos, setPendingPinPos] = useState<{ x: number; y: number } | null>(null);

  const { playRandom, stopAll, isRecording } = useSoundEngine();
  const storage = getKidStorage();

  // Auto-rotate timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Show home on mount
  useEffect(() => {
    // Start at home (index 0)
    setCurrentSceneIndex(0);
    setActiveProfile(null);
  }, []);

  // Load heard count when profile changes
  useEffect(() => {
    if (!activeProfile) return;
    void storage.getHeardCount(activeProfile.id).then(setHeardCount);
  }, [activeProfile, storage]);

  // Load pins whenever scene changes (only in scene loop, not home)
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

  // Initial timer on mount (only when in scene loop)
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSceneIndex]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only auto-rotate when not on home
    if (SCENES[currentSceneIndex]?.id === 'home') return;
    timerRef.current = setTimeout(() => {
      advanceScene(1);
    }, AUTO_ROTATE_MS);
  }, [currentSceneIndex]);

  // Advance by delta in "real scene" space (0 = farm, 1 = jungle, ...)
  const advanceScene = useCallback((delta: number) => {
    if (!activeProfile) return;
    // Compute real scene index from current SCENES index
    const currentRealIndex = currentSceneIndex - 1; // -1 because 0=home
    const newRealIndex = (currentRealIndex + delta + REAL_SCENE_COUNT) % REAL_SCENE_COUNT;
    setCurrentSceneIndex(realIndexToSceneIndex(newRealIndex));
    void storage.updateProfile({ ...activeProfile, lastSceneId: REAL_SCENES[newRealIndex].id });
  }, [currentSceneIndex, activeProfile, storage]);

  // Called when kid taps a profile card
  const handleSelectProfile = useCallback(async (profile: Profile) => {
    // Save to storage first
    await storage.saveProfile(profile);
    setActiveProfile(profile);
    // Resume at lastSceneId or farm
    const startSceneId = profile.lastSceneId && profile.lastSceneId !== 'home'
      ? profile.lastSceneId
      : 'farm';
    const startIndex = sceneIdToSceneIndex(startSceneId);
    setCurrentSceneIndex(startIndex);
    // Load pins for the start scene
    const scene = SCENES[startIndex];
    const pins = await storage.getPins(scene.id, profile.id);
    setPins(pins);
    const count = await storage.getHeardCount(profile.id);
    setHeardCount(count);
  }, [storage]);

  const onTapThing = useCallback((thing: Thing) => {
    resetTimer();
    stopAll();
    const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
    playRandom(sound);
    setHeardCount(c => c + 1);
    if (activeProfile) {
      void storage.markHeard(sound, activeProfile.id);
    }
  }, [playRandom, stopAll, resetTimer, activeProfile, storage]);

  // Swipe handling
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = e.clientX;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartRef.current === null) return;
    if (!activeProfile) return; // no swipe in home
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

  // Dot navigation — advance in real scene space
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
  // Compute which real index we're on (for dot indicator)
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

      <SceneBackground bg={scene.bg}>
        {/* Render pins BELOW things */}
        {pins.map(pin => (
          <PinTile key={pin.id} pin={pin} onDelete={onPinDelete} />
        ))}

        {scene.things.map(thing => (
          <ThingTile
            key={thing.id}
            thing={thing}
            onTap={() => onTapThing(thing)}
          />
        ))}
        <HeardCountBadge count={heardCount} />
      </SceneBackground>

      {/* Scene dot indicator — only real scenes */}
      <div style={{
        position: 'fixed',
        bottom: 20,
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