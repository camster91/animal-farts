import { useState, useCallback, useRef, useEffect } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { ThingTile } from './ThingTile';
import { HeardCountBadge } from './HeardCountBadge';
import { PinDropper } from './PinDropper';
import { PinTile } from './PinTile';
import { useSoundEngine } from './useSoundEngine';
import { getKidStorage } from './useKidStorage';
import type { Pin } from './useKidStorage';

// v26c: show exactly 2 scenes (Farm + Jungle), no more
const VISIBLE_SCENES = 2;
const SWIPE_THRESHOLD = 50; // px
const AUTO_ROTATE_MS = 30_000; // 30 seconds
const LONG_PRESS_MS = 500; // ms threshold for empty-area pin drop
const PROFILE_ID = 'default';

export default function KidScreen() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
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

  // Load pins whenever scene changes
  useEffect(() => {
    const scene = SCENES[currentSceneIndex];
    storage.getPins(scene.id, PROFILE_ID).then(setPins);
  }, [currentSceneIndex, storage]);

  // Pause auto-rotate while recording
  useEffect(() => {
    if (isRecording()) {
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      resetTimer();
    }
  }, [isRecording]);

  // Initial timer on mount
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSceneIndex(prev => (prev + 1) % VISIBLE_SCENES);
    }, AUTO_ROTATE_MS);
  }, []);

  const onTapThing = useCallback((thing: Thing) => {
    resetTimer();
    stopAll();
    const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
    playRandom(sound);
    setHeardCount(c => c + 1);
  }, [playRandom, stopAll, resetTimer]);

  // Swipe handling
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = e.clientX;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerStartRef.current === null) return;
    const delta = e.clientX - pointerStartRef.current;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      resetTimer();
      pointerStartRef.current = null;
      return;
    }
    if (delta < 0) {
      setCurrentSceneIndex(prev => (prev + 1) % VISIBLE_SCENES);
    } else {
      setCurrentSceneIndex(prev => (prev - 1 + VISIBLE_SCENES) % VISIBLE_SCENES);
    }
    pointerStartRef.current = null;
    resetTimer();
  }, [resetTimer]);

  // Empty-area long-press detection on the transparent overlay div.
  // The overlay sits INSIDE the root div so events bubble up to the root's
  // swipe handler — but we use pendingPinPos as a gate so that:
  //   - If long-press fires → pendingPinPos is set → root's onPointerUp skips swipe logic
  //   - If short tap → timer cancelled before 500ms → root's onPointerUp does normal swipe check
  const onScenePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setPendingPinPos({ x, y });
    }, LONG_PRESS_MS);
  }, []);

  const onScenePointerUp = useCallback(() => {
    // Only clear if the timer hasn't fired yet (null = already fired)
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

  const scene = SCENES[currentSceneIndex];

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'relative', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Long-press detector — sits behind things (lower zIndex) so things get events first */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          // transparent — just captures pointer events for long-press
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

      {/* Scene dot indicator */}
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
        {Array.from({ length: VISIBLE_SCENES }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i === currentSceneIndex ? '#fff' : 'rgba(255,255,255,0.45)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              transition: 'background 200ms, transform 200ms',
              transform: i === currentSceneIndex ? 'scale(1.25)' : 'scale(1)',
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
          profileId={PROFILE_ID}
          onSave={onPinSave}
          onCancel={onPinCancel}
        />
      )}
    </div>
  );
}