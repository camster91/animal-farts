import type { FC } from "react";
import type { BuiltInSound } from "../types";

interface SoundLibraryProps {
  builtInSounds: BuiltInSound[];
  alreadyAddedKeys: Set<string>;
  onPick: (sound: BuiltInSound) => void;
  onClose: () => void;
}

const COLS = 6;

const SoundLibrary: FC<SoundLibraryProps> = ({
  builtInSounds,
  alreadyAddedKeys,
  onPick,
  onClose,
}) => {
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
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "white",
          }}
        >
          Pick a sound
        </h2>
        <button
          onClick={onClose}
          aria-label="Close library"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            cursor: "pointer",
            color: "white",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 10,
          alignContent: "start",
        }}
      >
        {builtInSounds.map((sound) => {
          const isAdded = alreadyAddedKeys.has(sound.key);
          return (
            <button
              key={sound.key}
              onClick={() => !isAdded && onPick(sound)}
              disabled={isAdded}
              aria-label={`${sound.name} sound${isAdded ? " (already added)" : ""}`}
              aria-disabled={isAdded}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 4px",
                borderRadius: 12,
                background: isAdded ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                border: "none",
                cursor: isAdded ? "not-allowed" : "pointer",
                opacity: isAdded ? 0.4 : 1,
                transition: "opacity 150ms ease",
              }}
            >
              <span style={{ fontSize: 28 }}>{sound.emoji}</span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: isAdded ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  lineHeight: 1.2,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sound.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SoundLibrary;