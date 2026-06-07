// Poot Party — RecordingThing component. v26g.
// Wraps a scene thing with tap-to-play and long-press-to-record behavior.
// Long-press (500ms) starts a 3-second recording. Release or timeout stops it.
// When a thing has a kid recording, long-press shows a Keep/Delete dialog.

import { useState, useRef, useCallback, useEffect } from "react";
import type { Thing } from "./scenes";
import { getAudioEngine } from "../audio/engine";
import { getKidStorage } from "./useKidStorage";
import {
  injectKeyframes,
  randomKidEmoji,
  randomReactionType,
  getReactionDuration,
  type ReactionType,
} from "./reactions";

injectKeyframes();

interface RecordingThingProps {
  thing: Thing;
  sceneId: string;
  profileId: string;
  /** Called with (blobUrl, thing) when kid taps this thing */
  onPlayKidRecording: (url: string, thing: Thing, e?: React.MouseEvent) => void;
  children: React.ReactNode;
  /** Stagger offset (ms) for the idle wobble */
  wobbleOffset?: number;
  /** Index in the scene — used to stagger the entrance animation */
  index?: number;
  /** When true, all things do a shake-jiggle (shake-to-shuffle) */
  shakeJitter?: boolean;
}

const ANIMATION_MAP: Record<ReactionType, string> = {
  bounce: "react-bounce 400ms ease-out forwards",
  spin:   "react-spin 450ms ease-in-out forwards",
  shake:  "react-shake 350ms ease-in-out forwards",
  squish: "react-squish 400ms ease-in-out forwards",
  jump:   "react-jump 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
  pop:    "react-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
};

export function RecordingThing({
  thing,
  sceneId,
  profileId,
  onPlayKidRecording,
  children,
  wobbleOffset = 0,
  index = 0,
  shakeJitter = false,
}: RecordingThingProps) {
  const [recording, setRecording] = useState(false);
  const [hasKidRecording, setHasKidRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState<"success" | "warn" | null>(null);
  const [showPill, setShowPill] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(null);
  const [isWobbling, setIsWobbling] = useState(false);

  const pressTimer = useRef<number | null>(null);
  const tileRef = useRef<HTMLButtonElement>(null);
  const lastTapRef = useRef<number>(Date.now());
  const wobbleTimerRef = useRef<number | null>(null);
  const reactionKeyRef = useRef<number>(0);
  const currentRecIdRef = useRef<string | null>(null);

  const engine = getAudioEngine();
  const storage = getKidStorage();

  // Check if this thing already has a kid recording
  useEffect(() => {
    let cancelled = false;
    storage.getRecordingsForThing(sceneId, thing.id, profileId).then((recs) => {
      if (!cancelled) {
        setHasKidRecording(recs.length > 0);
        if (recs.length > 0) currentRecIdRef.current = recs[0].id;
      }
    });
    return () => { cancelled = true; };
  }, [thing.id, sceneId, profileId]);

  // Ambient idle wobble: if not tapped in 8s, do a subtle scale pulse once
  useEffect(() => {
    const scheduleWobble = () => {
      const delay = 8_000 + wobbleOffset;
      wobbleTimerRef.current = window.setTimeout(() => {
        const elapsed = Date.now() - lastTapRef.current;
        if (elapsed >= 8_000) {
          setIsWobbling(true);
          setTimeout(() => {
            setIsWobbling(false);
            scheduleWobble();
          }, 1_600);
        } else {
          scheduleWobble();
        }
      }, delay);
    };
    const initialDelay = window.setTimeout(() => scheduleWobble(), 8_000 + wobbleOffset);
    return () => {
      clearTimeout(initialDelay);
      if (wobbleTimerRef.current) clearTimeout(wobbleTimerRef.current);
    };
  }, [wobbleOffset]);

  // Spawn floating emojis at tap point
  const spawnFloatingEmojis = useCallback(() => {
    const el = tileRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Poot puff
    const poof = document.createElement("div");
    poof.textContent = "💨";
    poof.style.cssText = [
      "position: fixed",
      "pointer-events: none",
      "z-index: 998",
      "font-size: 1.6rem",
      `left: ${cx - 14}px`,
      `top: ${cy - 14}px`,
      "animation: poof-rise 0.7s ease-out forwards",
    ].join(";");
    document.body.appendChild(poof);
    setTimeout(() => poof.remove(), 750);

    // Bigger kid emoji (slightly offset, slightly delayed)
    setTimeout(() => {
      const emoji = document.createElement("div");
      emoji.textContent = randomKidEmoji();
      emoji.style.cssText = [
        "position: fixed",
        "pointer-events: none",
        "z-index: 999",
        "font-size: 2.2rem",
        `left: ${cx - 18 + (Math.random() - 0.5) * 24}px`,
        `top: ${cy - 18}px`,
        "animation: reaction-rise 1s ease-out forwards",
      ].join(";");
      document.body.appendChild(emoji);
      setTimeout(() => emoji.remove(), 1_050);
    }, 60);
  }, []);

  // Tap: play kid's recording if one exists, otherwise a random default sound.
  // Accepts the React MouseEvent so we can forward the tap coordinates
  // up to KidScreen for the band-chain music notes to appear at the
  // tap point.
  const onTap = useCallback(async (e?: React.MouseEvent) => {
    lastTapRef.current = Date.now();
    setIsWobbling(false);

    // Cancel any in-progress reaction so rapid taps restart animation
    setCurrentReaction(null);
    setTimeout(() => {
      const type = randomReactionType();
      setCurrentReaction(type);
      reactionKeyRef.current += 1;
      const duration = getReactionDuration(type);
      setTimeout(() => setCurrentReaction(null), duration);
    }, 0);

    spawnFloatingEmojis();

    const kidRecs = await storage.getRecordingsForThing(sceneId, thing.id, profileId);
    if (kidRecs.length > 0) {
      const url = URL.createObjectURL(kidRecs[0].blob);
      onPlayKidRecording(url, thing, e);
      setShowPill(true);
      setTimeout(() => setShowPill(false), 1000);
    } else {
      // Check for a parent-uploaded custom sound (per-profile)
      const uploaded = await storage.getUploadedSound(sceneId, thing.id, profileId);
      if (uploaded) {
        await engine.playBlob(uploaded.blob);
        setShowPill(true);
        setTimeout(() => setShowPill(false), 1000);
      } else {
        const sound = thing.sounds[Math.floor(Math.random() * thing.sounds.length)];
        onPlayKidRecording(sound, thing, e);
      }
    }
  }, [thing, sceneId, profileId, onPlayKidRecording, engine, storage]);

  // Long-press (500ms): start recording OR show delete dialog if has recording
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); // prevent event bubbling to scene container's long-press detector
    pressTimer.current = window.setTimeout(async () => {
      // If already has a recording, show delete dialog instead of recording
      const kidRecs = await storage.getRecordingsForThing(sceneId, thing.id, profileId);
      if (kidRecs.length > 0) {
        currentRecIdRef.current = kidRecs[0].id;
        setShowDeleteDialog(true);
        return;
      }

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
        currentRecIdRef.current = id;
        setShowEmoji("success");
        setTimeout(() => setShowEmoji(null), 1200);
        const url = URL.createObjectURL(result.blob);
        onPlayKidRecording(url, thing);
      } else {
        // Mic denied or unavailable
        setShowEmoji("warn");
        setTimeout(() => setShowEmoji(null), 1500);
      }
    }, 500);
  }, [thing, sceneId, profileId, onPlayKidRecording]);

  // Release / leave: cancel the long-press timer if it hasn't fired yet
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const handleDeleteRecording = useCallback(async () => {
    const recId = currentRecIdRef.current;
    if (recId) {
      await storage.deleteRecording(recId);
      setHasKidRecording(false);
      currentRecIdRef.current = null;
    }
    setShowDeleteDialog(false);
  }, [storage]);

  const handleKeepRecording = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  const animStyle = currentReaction ? ANIMATION_MAP[currentReaction] : undefined;

  return (
    <>
      <button
        ref={tileRef}
        onClick={onTap}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerCancel}
        style={{
          position: "absolute",
          left: `${thing.x}%`,
          top: `${thing.y}%`,
          transform: "translate(-50%, -50%)" + (isWobbling ? " scale(1.04)" : ""),
          width: `${thing.size}vw`,
          height: `${thing.size}vw`,
          transition: isWobbling
            ? "transform 1600ms ease-in-out"
            : "transform 100ms ease-out",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          animationDelay: `${index * 60}ms`,
        }}
        className={`absolute select-none thing-entrance ${
          recording ? "animate-pulse" : "active:scale-90 transition-transform"
        }${shakeJitter ? " shake-jiggle" : ""}`}
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
            {showEmoji === "success" ? "🎉" : "⚠️"}
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

        <span
          key={reactionKeyRef.current}
          className="block w-full h-full flex items-center justify-center text-6xl sm:text-7xl drop-shadow-lg"
          style={{
            animation: animStyle ?? (isWobbling ? "ambient-wobble 1.6s ease-in-out" : "scale-bounce 280ms ease-out"),
          }}
        >
          {children}
        </span>
      </button>

      {/* Delete recording dialog */}
      {showDeleteDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
          onClick={handleKeepRecording}
        >
          <div
            style={{
              background: "white",
              borderRadius: "1.2rem",
              padding: "1.5rem",
              maxWidth: "22rem",
              width: "85vw",
              textAlign: "center",
              fontFamily: "Fredoka, system-ui, sans-serif",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#333", margin: "0 0 0.2rem" }}>
              You already recorded this one!
            </p>
            <p style={{ fontSize: "0.9rem", color: "#666", margin: "0 0 1.2rem" }}>
              Keep it or delete and re-record?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={handleKeepRecording}
                style={{
                  flex: 1,
                  padding: "0.6rem 1rem",
                  borderRadius: "0.8rem",
                  border: "2px solid #ddd",
                  background: "white",
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#555",
                  cursor: "pointer",
                }}
              >
                Keep
              </button>
              <button
                onClick={handleDeleteRecording}
                style={{
                  flex: 1,
                  padding: "0.6rem 1rem",
                  borderRadius: "0.8rem",
                  border: "2px solid #f472b6",
                  background: "#fce7f3",
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "#be185d",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
