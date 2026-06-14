// Audio (single voice — stop and play).
//
// Sound toy for kids. To prevent the audio from becoming a wall of
// overlapping chaos when many circles bump at the same time, we
// enforce a single-voice policy: when a new sound wants to play,
// we stop ALL currently-playing sounds first, then start the new
// one. Each tap or collision is its own distinct sound — no two
// sounds ever overlap.
//
// v59: also tracks which bubble is currently playing so the UI
// can show a visual "playing" state and let the user tap the
// playing bubble to stop it.

const activeAudioElements = new Set<HTMLAudioElement>();

// The bubble that the currently-playing audio was triggered by.
// null = no sound playing OR the sound was triggered by a non-bubble
// event (e.g. shake-to-stop starts a new sound, but doesn't apply
// here — shake STOPS sounds, doesn't start). Used by the canvas
// to render a pulse animation on the playing bubble, and by the
// tap handler to detect "tap the playing bubble" → stop instead of
// restart.
let currentBubbleId: string | null = null;

export function playSingle(sound: string, volume: number, bubbleId?: string): void {
  // Stop any currently playing sounds
  for (const a of activeAudioElements) {
    try {
      a.pause();
    } catch {
      // ignore
    }
  }
  activeAudioElements.clear();
  currentBubbleId = null;

  const a = new Audio(sound);
  a.volume = volume;
  const remove = () => {
    activeAudioElements.delete(a);
    // If this was the last playing element, clear currentBubbleId
    // too. (Multiple plays can theoretically interleave if a
    // tap fires before the previous one ends; the next playSingle
    // already clears it.)
    if (activeAudioElements.size === 0) currentBubbleId = null;
  };
  a.addEventListener("ended", remove, { once: true });
  a.addEventListener("error", remove, { once: true });
  // Hard safety net: if 'ended' never fires, remove after 10s
  setTimeout(remove, 10_000);
  activeAudioElements.add(a);
  currentBubbleId = bubbleId ?? null;
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
  currentBubbleId = null;
}

// True if any sound is currently playing.
export function isAnySoundPlaying(): boolean {
  return activeAudioElements.size > 0;
}

// The bubble that the currently-playing audio was triggered by, or
// null if no sound is playing (or the playing sound wasn't tied to a
// bubble). Used by useSoundPlaying + handleBubbleTap to detect
// "tap the playing bubble".
export function getCurrentBubbleId(): string | null {
  return currentBubbleId;
}
