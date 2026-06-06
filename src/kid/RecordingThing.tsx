// Poot Party — RecordingThing component. v26.
// Wraps a scene thing with tap-to-play and long-press-to-record behavior.
// Long-press (500ms) starts a 3-second recording. Release or timeout stops it.

import { useState, useRef, useCallback, useEffect } from "react";
import { getAudioEngine } from "../audio/engine";
import { getKidStorage } from "./useKidStorage";

// Thing shape (matches src/kid/scenes.ts Thing, owned by the v26a agent)
export type ThingShape = {
  id: string;
  emoji: string;
  name: string;
  x: number;
  y: number;
  size: number;
  sounds: string[];
};

interface RecordingThingProps {
  thing: ThingShape;
  sceneId: string;
  profileId: string;
  /** Called with (blobUrl, thing) when kid taps this thing */
  onPlayKidRecording: (url: string, thing: ThingShape) => void;
  children: React.ReactNode;
}

export function RecordingThing({
  thing,
  sceneId,
  profileId,
  onPlayKidRecording,
  children,
}: RecordingThingProps) {
  const [recording, setRecording] = useState(false);
  const [hasKidRecording, setHasKidRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState<'success' | 'warn' | null>(null);
  const [showPill, setShowPill] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const engine = getAudioEngine();
  const storage = getKidStorage();

  // Check if this thing already has a kid recording
  useEffect(() => {
    let cancelled = false;
    storage.getRecordingsForThing(sceneId, thing.id, profileId).then((recs) => {
      if (!cancelled) setHasKidRecording(recs.length > 0);
    });
    return () => { cancelled = true; };
  }, [thing.id, sceneId, profileId]);

  // Tap: play kid's recording if one exists, otherwise a random default sound
  const onTap = useCallback(async () => {
    const kidRecs = await storage.getRecordingsForThing(sceneId, thing.id, profileId);
    if (kidRecs.length > 0) {
      const url = URL.createObjectURL(kidRecs[0].blob);
      onPlayKidRecording(url, thing);
      setShowPill(true);
      setTimeout(() => setShowPill(false), 1000);
    } else {
      const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
      onPlayKidRecording(sound, thing);
    }
  }, [thing, sceneId, profileId, onPlayKidRecording]);

  // Long-press (500ms): start recording
  const onPointerDown = useCallback(() => {
    pressTimer.current = window.setTimeout(async () => {
      setRecording(true);
      const result = await engine.record({ maxDurationMs: 3000 });
      setRecording(false);
      if (result) {
        const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await storage.saveRecording({
          id,
          sceneId,
          thingId: thing.id,
          blob: result.blob,
          duration: result.duration,
          mimeType: result.mimeType,
          createdAt: Date.now(),
          profileId,
        });
        setHasKidRecording(true);
        setShowEmoji('success');
        setTimeout(() => setShowEmoji(null), 1200);
        const url = URL.createObjectURL(result.blob);
        onPlayKidRecording(url, thing);
      } else {
        // Mic denied or unavailable
        setShowEmoji('warn');
        setTimeout(() => setShowEmoji(null), 1500);
      }
    }, 500);
  }, [thing, sceneId, profileId, onPlayKidRecording]);

  // Release / leave: cancel the long-press timer if it hasn't fired yet
  const onPointerUp = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  return (
    <button
      onClick={onTap}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        left: `${thing.x}%`,
        top: `${thing.y}%`,
        transform: "translate(-50%, -50%)",
        width: `${thing.size}%`,
        height: `${thing.size}%`,
        touchAction: "manipulation",
      }}
      className={`flex items-center justify-center select-none ${
        recording ? "animate-pulse" : "active:scale-90 transition-transform"
      }`}
      aria-label={`${thing.name}, tap to hear a sound${
        hasKidRecording ? ", you have a recording" : ""
      }`}
    >
      {recording && (
        <div className="absolute inset-0 rounded-full ring-4 ring-red-500/70 animate-ping" />
      )}

      {/* Pink dot: has kid recording */}
      {hasKidRecording && (
        <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-white" />
      )}

      {/* Floating emoji: success 🎉 or warn ⚠️ */}
      {showEmoji && (
        <span
          className="absolute text-xl pointer-events-none"
          style={{
            top: "-16px",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "floatUp 1.2s ease-out forwards",
          }}
        >
          {showEmoji === 'success' ? '🎉' : '⚠️'}
        </span>
      )}

      {/* "your sound" pill */}
      {showPill && (
        <span
          className="absolute text-xs pointer-events-none px-1.5 py-0.5 rounded-full bg-pink-500 text-white font-medium"
          style={{
            top: "-20px",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: "10px",
            animation: "fadeOut 1s ease-out forwards",
          }}
        >
          your sound
        </span>
      )}

      {children}
    </button>
  );
}
