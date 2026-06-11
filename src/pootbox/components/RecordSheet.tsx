import type { FC } from "react";

interface RecordSheetProps {
  recPhase: "idle" | "recording" | "picking";
  recordingMs: number;
  onMicButtonClick?: () => void; // only used in non-recording idle state (future)
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onPickEmoji: (emoji: string) => void;
  onRedo: () => void;
  emojiOptions: string[];
}

// 12 animal quick-pick emoji (same as default page)
const QUICK_PICKS = ["🐄", "🐕", "🐈", "🐖", "🦆", "🦁", "🐸", "🐒", "🐎", "🐘", "🐓", "🐻"];

// 30+ random emoji — distinct from the 12 above
const RANDOM_POOL = [
  "🌈", "⭐", "🎈", "🎵", "🌟", "🐳", "🦄", "🍕", "🎪", "🐙", "🦋",
  "🌸", "🍦", "🎁", "🚀", "🌙", "🎨", "🎭", "🎬", "🎻", "🏖️", "🦜",
  "🐬", "🦩", "�豹", "🦔", "�章", "🦒", "🦫", "�璚",
];

export function pickRandomEmoji(exclude: string[] = []): string {
  const pool = RANDOM_POOL.filter(e => !exclude.includes(e));
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  return `${s}.${frac.toString().padStart(2, "0")}`;
}

const COLS = 6;
const ROWS = 5;

const RecordSheet: FC<RecordSheetProps> = ({
  recPhase,
  recordingMs,
  onCancelRecording,
  onStopRecording,
  onPickEmoji,
  onRedo,
  emojiOptions,
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
              margin: "0 0 20px",
            }}
          >
            Pick an emoji for your sound
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 10,
              maxWidth: COLS * 56 + (COLS - 1) * 10,
              width: "100%",
            }}
          >
            {emojiOptions.slice(0, COLS * ROWS).map((emoji) => (
              <button
                key={emoji}
                onClick={() => onPickEmoji(emoji)}
                aria-label={`Sound emoji ${emoji}`}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  transition: "transform 100ms ease",
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            onClick={onRedo}
            style={{
              marginTop: 24,
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
        </>
      )}
    </div>
  );
};

export default RecordSheet;