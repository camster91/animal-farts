import { useState, useCallback, useRef, useEffect } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { ThingTile } from './ThingTile';
import { HeardCountBadge } from './HeardCountBadge';
import { useSoundEngine } from './useSoundEngine';

// v26b: show exactly 2 scenes (Farm + Jungle), no more
const VISIBLE_SCENES = 2;
const SWIPE_THRESHOLD = 50; // px
const AUTO_ROTATE_MS = 30_000; // 30 seconds

export default function KidScreen() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [heardCount, setHeardCount] = useState(0);

  const { playRandom, stopAll, isRecording } = useSoundEngine();

  // Auto-rotate timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentSceneIndex(prev => (prev + 1) % VISIBLE_SCENES);
    }, AUTO_ROTATE_MS);
  }, []);

  // Pause auto-rotate while recording
  useEffect(() => {
    if (isRecording()) {
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      resetTimer();
    }
  }, [isRecording, resetTimer]);

  // Initial timer on mount
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

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
      // Treat as a tap — reset auto-rotate timer
      resetTimer();
      pointerStartRef.current = null;
      return;
    }
    if (delta < 0) {
      // Swipe left → next scene
      setCurrentSceneIndex(prev => (prev + 1) % VISIBLE_SCENES);
    } else {
      // Swipe right → previous scene
      setCurrentSceneIndex(prev => (prev - 1 + VISIBLE_SCENES) % VISIBLE_SCENES);
    }
    pointerStartRef.current = null;
    // Reset timer on swipe too
    resetTimer();
  }, [resetTimer]);

  const scene = SCENES[currentSceneIndex];

  return (
    <div
      style={{ width: '100vw', height: '100vh', position: 'relative', userSelect: 'none', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <SceneBackground bg={scene.bg}>
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
    </div>
  );
}