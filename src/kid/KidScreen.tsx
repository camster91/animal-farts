import { useState, useCallback, useEffect, useRef } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { ThingTile } from './ThingTile';
import { HeardCountBadge } from './HeardCountBadge';
import { useSoundEngine } from './useSoundEngine';

const AUTO_ADVANCE_MS = 30_000;

function SceneDots({ total, current, onSelect }: { total: number; current: number; onSelect: (i: number) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            style={{
              pointerEvents: 'auto',
              background: 'none',
              border: 'none',
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={`Go to scene ${i + 1}`}
          >
            <div
              style={{
                width: isActive ? 8 : 6,
                height: isActive ? 8 : 6,
                borderRadius: '50%',
                background: isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.3)',
                transition: 'width 0.2s, height 0.2s, background 0.2s',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

export default function KidScreen() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const { playRandom, stopAll, isRecording } = useSoundEngine();
  const [heardCount, setHeardCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scene = SCENES[sceneIndex];

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (SCENES.length < 2) return;
    timerRef.current = setTimeout(() => {
      setSceneIndex(i => (i + 1) % SCENES.length);
    }, AUTO_ADVANCE_MS);
  }, [clearTimer]);

  // Start timer on mount (or when scenes change)
  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  const advanceToScene = useCallback((index: number) => {
    setSceneIndex(index);
    clearTimer();
    startTimer();
  }, [clearTimer, startTimer]);

  const onTapThing = useCallback((thing: Thing) => {
    // Pause auto-advance while recording so we don't yank the kid mid-fart
    if (isRecording()) return;
    stopAll();
    const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
    playRandom(sound);
    setHeardCount(c => c + 1);
    // Reset auto-advance on interaction
    clearTimer();
    startTimer();
  }, [playRandom, stopAll, isRecording, clearTimer, startTimer]);

  return (
    <SceneBackground bg={scene.bg}>
      {scene.things.map(thing => (
        <ThingTile
          key={thing.id}
          thing={thing}
          onTap={() => onTapThing(thing)}
        />
      ))}
      <HeardCountBadge count={heardCount} />
      <SceneDots total={SCENES.length} current={sceneIndex} onSelect={advanceToScene} />
    </SceneBackground>
  );
}
