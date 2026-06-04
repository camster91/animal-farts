// Helpers for promoting a feed (public) recording into the user's local
// "My Farts" library. Runs fully client-side: we fetch the audio from the
// server once, wrap it in a local blob URL, and append it to the same
// localStorage list that `saveRecording` writes to.
//
// Using a separate module (not a hook) so FeedRecordingCard — a leaf
// component — can call it without prop-drilling 6 levels up.

import { loadRecordings, saveRecording, type CustomRecording } from "../audio/fartEngine";
import { type FeedRecording } from "./serverApi";

/**
 * Save a public feed recording to the user's "My Farts" library.
 * Returns the newly created local CustomRecording, or null on failure
 * (network, decoding, quota).
 */
export async function saveFeedRecordingToMyFarts(rec: FeedRecording): Promise<CustomRecording | null> {
  try {
    const resp = await fetch(rec.audioUrl);
    if (!resp.ok) throw new Error(`fetch ${resp.status}`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const all = loadRecordings();
    // Find next free slot number
    let i = 1;
    while (all.some((r) => r.id === `rec-${i}`)) i++;
    // Stash the original feed metadata so the recording can still be
    // recognised as "borrowed from feed" if the UI ever needs to show it.
    const newRec = saveRecording({
      name: rec.name,
      emoji: rec.emoji,
      url,
      visibility: "local", // copied into "my farts" stays local until posted
      serverId: null,
    });
    return newRec;
  } catch (err) {
    console.warn("[sounds] saveFeedRecordingToMyFarts failed:", err);
    return null;
  }
}
