import { useState, useCallback } from 'react';
import { SCENES } from './scenes';
import type { Thing } from './scenes';
import { SceneBackground } from './SceneBackground';
import { ThingTile } from './ThingTile';
import { HeardCountBadge } from './HeardCountBadge';
import { useSoundEngine } from './useSoundEngine';

export default function KidScreen() {
  const scene = SCENES[0]; // v26a: 1 scene. v26c adds swipe.
  const { playRandom, stopAll } = useSoundEngine();
  const [heardCount, setHeardCount] = useState(0);

  const onTapThing = useCallback((thing: Thing) => {
    stopAll();
    const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
    playRandom(sound);
    setHeardCount(c => c + 1);
  }, [playRandom, stopAll]);

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
    </SceneBackground>
  );
}
