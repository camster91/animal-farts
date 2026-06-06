// Poot Party — PinTile component. v26c.
// A pin dropped by the kid in the scene. Tap to play recording, long-press to delete.

import { useState, useRef, useCallback, useEffect } from "react";
import { getKidStorage } from "./useKidStorage";
import type { Pin } from "./useKidStorage";

interface Props {
  pin: Pin;
  onDelete: (id: string) => void;
}

export function PinTile({ pin, onDelete }: Props) {
  const confirmDeleteRef = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scale, setScale] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const storage = getKidStorage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const hasShownConfettiRef = useRef(false);

  // Load recording URL once
  useEffect(() => {
    let cancelled = false;
    storage.getRecording(pin.recordingId).then((rec) => {
      if (cancelled || !rec) return;
      blobUrlRef.current = URL.createObjectURL(rec.blob);
    });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [pin.recordingId, storage]);

  // Scale-in animation + one-shot confetti on mount
  useEffect(() => {
    setScale(1.2);
    const t = setTimeout(() => setScale(1), 200);
    // Show confetti once on first mount
    if (!hasShownConfettiRef.current) {
      hasShownConfettiRef.current = true;
      setShowConfetti(true);
      const ct = setTimeout(() => setShowConfetti(false), 1500);
      return () => {
        clearTimeout(t);
        clearTimeout(ct);
      };
    }
    return () => clearTimeout(t);
  }, []);

  const onTap = useCallback(() => {
    if (confirmDeleteRef.current) return;
    if (blobUrlRef.current) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const a = new Audio(blobUrlRef.current);
      audioRef.current = a;
      void a.play();
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    pressTimer.current = window.setTimeout(() => {
      confirmDeleteRef.current = true;
      setConfirmDelete(true);
    }, 500);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onDeleteConfirm = useCallback(() => {
    onDelete(pin.id);
  }, [onDelete, pin.id]);

  return (
    <>
      {showConfetti && (
        <div
          style={{
            position: "absolute",
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 200,
            fontSize: 28,
            animation: "pin-confetti 1.5s ease-out forwards",
          }}
        >
          🎊
        </div>
      )}

      {confirmDelete ? (
        <div
          style={{
            position: "absolute",
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 300,
            background: "#fff",
            border: "3px solid #ff4444",
            borderRadius: 16,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(255,0,0,0.3)",
            minWidth: 120,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: "#333" }}>
            Delete this poot?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                border: "none",
                background: "#ff4444",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Yes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); confirmDeleteRef.current = false; setConfirmDelete(false); }}
              style={{
                padding: "6px 14px",
                borderRadius: 10,
                border: "2px solid #ddd",
                background: "#fff",
                color: "#666",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 150,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
          aria-label={`Pin: ${pin.emoji}, tap to play recording`}
        >
          {/* Emoji */}
          <span style={{ fontSize: "2.4rem", lineHeight: 1, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}>
            {pin.emoji}
          </span>
          {/* Mic indicator */}
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#ff6b9d",
              border: "2px solid #fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
            }}
          >
            🎤
          </div>
        </button>
      )}

      <style>{`
        @keyframes pin-confetti {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
          50%  { opacity: 1; transform: translate(-50%, -80%) scale(1.3); }
          100% { opacity: 0; transform: translate(-50%, -120%) scale(1); }
        }
      `}</style>
    </>
  );
}