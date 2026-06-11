import type { FC } from "react";
import { QUICK_PICKS, pickRandomEmoji } from "./recordSheetUtils";

interface RecordSheetProps {
  recPhase: "idle" | "recording" | "picking";
  recordingMs: number;
  onMicButtonClick?: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onPickEmoji: (emoji: string) => void;
  onRedo: () => void;
  emojiOptions: string[];
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  return `${s}.${frac.toString().padStart(2, "0")}`;
}

const RecordSheet: FC<RecordSheetProps> = ({
  recPhase,
  recordingMs,
  onCancelRecording,
  onStopRecording,
  onPickEmoji,
  onRedo,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  emojiOptions: _unused,
}) => {
  if (recPhase === "idle") return null;

  const isRecording = recPhase === "recording";
  const isPicking = recPhase === "picking";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,44,30,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      {isRecording && (
        <>
          <button
            onClick={onStopRecording}
            aria-label="Stop recording"
            style={{
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "#EF4444",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(239,68,68,0.4)",
              transition: "transform 100ms ease",
              padding: 0,
            }}
          >
            <span style={{ fontSize: 72, color: "white" }}>🎙</span>
          </button>

          <p
            style={{
              marginTop: 24,
              fontSize: "1.1rem",
              color: "rgba(255,255,255,0.85)",
              fontWeight: 600,
            }}
          >
            Tap the mic to stop
          </p>

          <p
            style={{
              marginTop: 12,
              fontSize: "2rem",
              fontWeight: 700,
              color: "white",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatMs(recordingMs)}
          </p>

          <button
            onClick={onCancelRecording}
            style={{
              marginTop: 32,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.9rem",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </>
      )}

      {isPicking && (
        <>
          <p
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "white",
              margin: "0 0 16px",
            }}
          >
            Pick an emoji for your sound
          </p>

          {/* Inline emoji strip — horizontal scroll */}
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              padding: "8px 4px",
              maxWidth: "100%",
              width: "100%",
              justifyContent: "center",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {QUICK_PICKS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onPickEmoji(emoji)}
                aria-label={`Sound emoji ${emoji}`}
                style={{
                  flexShrink: 0,
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  transition: "transform 100ms ease",
                }}
              >
                {emoji}
              </button>
            ))}

            {/* Divider */}
            <div
              style={{
                width: 1,
                background: "rgba(255,255,255,0.3)",
                flexShrink: 0,
                margin: "4px 2px",
              }}
            />

            {/* Random button — each tap rolls a new emoji */}
            <button
              onClick={() => onPickEmoji(pickRandomEmoji(QUICK_PICKS))}
              aria-label="Random emoji"
              style={{
                flexShrink: 0,
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                cursor: "pointer",
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                transition: "transform 100ms ease",
              }}
            >
              🎲
            </button>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
            <button
              onClick={onRedo}
              style={{
                background: "transparent",
                border: "2px solid rgba(255,255,255,0.4)",
                borderRadius: 16,
                cursor: "pointer",
                color: "white",
                fontSize: "1rem",
                fontFamily: "inherit",
                fontWeight: 600,
                padding: "10px 24px",
              }}
            >
              🔄 Redo
            </button>
            <button
              onClick={onCancelRecording}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.55)",
                fontSize: "0.9rem",
                fontFamily: "inherit",
              }}
            >
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RecordSheet;