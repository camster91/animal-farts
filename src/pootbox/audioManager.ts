// Audio (single voice — stop and play).
//
// Sound toy for kids. To prevent the audio from becoming a wall of
// overlapping chaos when many circles bump at the same time, we
// enforce a single-voice policy: when a new sound wants to play,
// we stop ALL currently-playing sounds first, then start the new
// one. Each tap or collision is its own distinct sound — no two
// sounds ever overlap.

const activeAudioElements = new Set<HTMLAudioElement>();

export function playSingle(sound: string, volume: number): void {
  // Stop any currently playing sounds
  for (const a of activeAudioElements) {
    try {
      a.pause();
    } catch {
      // ignore
    }
  }
  activeAudioElements.clear();

  const a = new Audio(sound);
  a.volume = volume;
  const remove = () => {
    activeAudioElements.delete(a);
  };
  a.addEventListener("ended", remove, { once: true });
  a.addEventListener("error", remove, { once: true });
  // Hard safety net: if 'ended' never fires, remove after 10s
  setTimeout(remove, 10_000);
  activeAudioElements.add(a);
  a.play().catch(() => {
    remove();
  });
}

// Stop every currently-playing sound. Used by the visible "stop" button
// in the UI so parents (and kids) can silence the app without leaving.
export function stopAllSounds(): void {
  for (const a of activeAudioElements) {
    try {
      a.pause();
    } catch {
      // ignore
    }
  }
  activeAudioElements.clear();
}

// True if any sound is currently playing.
export function isAnySoundPlaying(): boolean {
  return activeAudioElements.size > 0;
}
