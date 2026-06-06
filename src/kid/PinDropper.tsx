// Poot Party — PinDropper modal. v26c.
// Opens when kid long-presses empty area of the scene.
// Emoji picker + hold-to-record + save.

import { useState, useRef, useCallback, useEffect } from "react";
import { getAudioEngine } from "../audio/engine";
import { getKidStorage } from "./useKidStorage";
import { EMOJI_GRID } from "./useEmojiGrid";
import type { Pin } from "./useKidStorage";

interface Props {
  /** 0–100, % from left of scene container */
  x: number;
  /** 0–100, % from top of scene container */
  y: number;
  sceneId: string;
  profileId: string;
  onSave: (pin: Pin) => void;
  onCancel: () => void;
}

export function PinDropper({ x, y, sceneId, profileId, onSave, onCancel }: Props) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const pressTimer = useRef<number | null>(null);
  const engine = getAudioEngine();
  const storage = getKidStorage();

  const canSave = selectedEmoji !== null && recordedBlob !== null;

  // Cleanup blob URL on unmount
  const recordedUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (recordedUrl.current) URL.revokeObjectURL(recordedUrl.current);
    };
  }, []);

  // Hold-to-record: pointerdown starts timer, pointerup cancels or fires
  const onRecordPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); // prevent modal backdrop's long-press timer from also firing
    pressTimer.current = window.setTimeout(async () => {
      setRecording(true);
      const result = await engine.record({ maxDurationMs: 3000 });
      setRecording(false);
      if (result) {
        setRecordedBlob(result.blob);
        recordedUrl.current = URL.createObjectURL(result.blob);
      }
    }, 500);
  }, [engine]);

  const onPointerUp = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onReplay = useCallback(() => {
    if (recordedUrl.current) {
      const a = new Audio(recordedUrl.current);
      void a.play();
    }
  }, []);

  const onSavePin = useCallback(async () => {
    if (!canSave || !recordedBlob || !selectedEmoji) return;
    const recordingId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await storage.saveRecording({
      id: recordingId,
      sceneId,
      thingId: null,
      blob: recordedBlob,
      duration: 0,
      mimeType: recordedBlob.type || "audio/webm",
      createdAt: Date.now(),
      profileId,
    });
    const pin: Pin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sceneId,
      x,
      y,
      emoji: selectedEmoji,
      recordingId,
      createdAt: Date.now(),
      profileId,
    };
    await storage.savePin(pin);
    onSave(pin);
  }, [canSave, recordedBlob, selectedEmoji, storage, sceneId, x, y, profileId, onSave]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onPointerDown={onRecordPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      // Also handle touch events directly for iOS Safari
      onTouchStart={onRecordPointerDown as unknown as React.TouchEventHandler}
      onTouchEnd={onPointerUp as unknown as React.TouchEventHandler}
    >
      <div
        style={{
          background: "#FFFEF5",
          borderRadius: 28,
          padding: "24px 20px 20px",
          width: "min(360px, 92vw)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <p style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: 0 }}>
          Make a Poot! 💨
        </p>

        {/* Emoji grid */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#666", margin: "0 0 8px", textAlign: "center" }}>
            Choose your emoji:
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              maxHeight: 120,
              overflowY: "auto",
              padding: 4,
              background: "#f5f0e8",
              borderRadius: 16,
            }}
          >
            {EMOJI_GRID.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  fontSize: 22,
                  padding: "4px 2px",
                  border: selectedEmoji === emoji ? "3px solid #ff6b6b" : "3px solid transparent",
                  borderRadius: 10,
                  background: selectedEmoji === emoji ? "#fff0f0" : "transparent",
                  cursor: "pointer",
                  transition: "border 150ms, background 150ms",
                  lineHeight: 1,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Record button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {recordedBlob ? (
            <>
              <div
                style={{
                  background: "#e8ffe8",
                  border: "3px solid #4ade80",
                  borderRadius: 20,
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20 }}>✅</span>
                <span style={{ fontWeight: 700, color: "#166534", fontSize: 15 }}>Got it!</span>
              </div>
              <button
                onClick={onReplay}
                style={{
                  background: "transparent",
                  border: "2px solid #ccc",
                  borderRadius: 12,
                  padding: "6px 16px",
                  fontSize: 13,
                  color: "#555",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                🔁 Replay
              </button>
            </>
          ) : (
            <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {recording && (
                <div
                  style={{
                    position: "absolute",
                    inset: -10,
                    borderRadius: 40,
                    border: "4px solid rgba(255, 80, 80, 0.6)",
                    animation: "ping 0.8s cubic-bezier(0, 0, 0.2, 1) infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
              <div
                style={{
                  background: recording ? "#ff5050" : "#ff6b6b",
                  borderRadius: 24,
                  padding: "14px 28px",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  boxShadow: recording
                    ? "0 0 0 0 rgba(255,80,80,0.7)"
                    : "0 4px 16px rgba(255,107,107,0.4)",
                  transition: "background 200ms, box-shadow 200ms",
                  cursor: "pointer",
                  userSelect: "none",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                {recording ? "🎙️ Recording…" : " Hold to record "}
              </div>
              <span style={{ fontSize: 11, color: "#999", fontWeight: 500 }}>
                {recording ? "" : "Hold 3 sec max"}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 16,
              border: "2.5px solid #e0e0e0",
              background: "#fff",
              fontWeight: 700,
              fontSize: 14,
              color: "#666",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={canSave ? onSavePin : undefined}
            disabled={!canSave}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 16,
              border: "none",
              background: canSave ? "#ff6b6b" : "#e0e0e0",
              color: canSave ? "#fff" : "#aaa",
              fontWeight: 800,
              fontSize: 14,
              cursor: canSave ? "pointer" : "not-allowed",
              boxShadow: canSave ? "0 4px 16px rgba(255,107,107,0.35)" : "none",
              transition: "background 200ms, box-shadow 200ms",
            }}
          >
            Save Pin
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}