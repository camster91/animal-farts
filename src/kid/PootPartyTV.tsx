// Poot Party — Poot Party TV (auto-play mode).
// Full-screen scene cycler, no chrome, auto-advances every 5s.

import { useState, useEffect, useRef, useCallback } from 'react';
import { SCENES } from './scenes';
import { useSoundEngine } from './useSoundEngine';

const REAL_SCENES = SCENES.filter(s => s.id !== 'home');
const CYCLE_MS = 5000;

interface Props {
  tvModeEnabled: boolean;
  onExit: () => void;
}

export function PootPartyTV({ tvModeEnabled, onExit }: Props) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const { playRandom, stopAll } = useSoundEngine();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start at scene 0, play its first sound
  useEffect(() => {
    if (!tvModeEnabled) return;
    const scene = REAL_SCENES[0];
    if (scene?.things[0]) {
      const firstSound = scene.things[0].sounds[0];
      if (firstSound) playRandom(firstSound);
    }
  }, [tvModeEnabled]);

  // Advance scene every CYCLE_MS
  useEffect(() => {
    if (!tvModeEnabled) return;
    intervalRef.current = setInterval(() => {
      setSceneIndex(prev => (prev + 1) % REAL_SCENES.length);
    }, CYCLE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tvModeEnabled]);

  // When scene changes, play first thing's sound
  useEffect(() => {
    if (!tvModeEnabled) return;
    const scene = REAL_SCENES[sceneIndex];
    if (scene?.things[0]) {
      const firstSound = scene.things[0].sounds[0];
      if (firstSound) {
        stopAll();
        playRandom(firstSound);
      }
    }
  }, [sceneIndex, tvModeEnabled]);

  const handleNext = useCallback(() => {
    setSceneIndex(prev => (prev + 1) % REAL_SCENES.length);
  }, []);

  if (!tvModeEnabled) return null;

  const scene = REAL_SCENES[sceneIndex];

  return (
    <div
      onClick={onExit}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundImage: `url(${scene.bg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Scene things rendered full-screen */}
      {scene.things.map((thing) => (
        <div
          key={thing.id}
          style={{
            position: 'absolute',
            left: `${thing.x}%`,
            top: `${thing.y}%`,
            width: `${thing.size}vw`,
            height: `${thing.size}vw`,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(2rem, 8vw, 5rem)',
            pointerEvents: 'none',
          }}
        >
          {thing.emoji}
        </div>
      ))}

      {/* Manual next scene button — only shown, parent enables it via tvModeEnabled */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleNext();
        }}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.45)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.4rem',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        aria-label="Next scene"
      >
        ⏭️
      </button>
    </div>
  );
}
