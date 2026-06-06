// v26a: thin wrapper around the v26 audio engine.
// The engine handles auto-stop-on-tap, FX, and recording.
// KidScreen consumes this hook — it never touches the engine directly,
// so v26b's recording flow can swap implementations without UI changes.

import { getAudioEngine } from '../audio/engine';

export function useSoundEngine() {
  const engine = getAudioEngine();
  return {
    // Pick a random sound from a pool and play it.
    playRandom: (sound: string): void => {
      void engine.play(sound);
    },
    stopAll: () => engine.stopAll(),
    setPitch: engine.setPitch,
    setSpeed: engine.setSpeed,
    setReverb: engine.setReverb,
    record: engine.record,
    isRecording: engine.isRecording,
  };
}
