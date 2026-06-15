// RenameModal.tsx — v69: small modal for renaming a custom-
// recorded sound. Used when the user taps the "rename" button
// on a custom card. The input is auto-focused, max 24 chars
// (matches the storage cap in saveRecordingName), Save commits
// + closes, Cancel just closes.

import { useState, useEffect, useRef, type FC } from "react";

interface RenameModalProps {
  show: boolean;
  initialName: string;
  emoji: string; // shown as a visual hint (the chosen emoji for the recording)
  onSave: (name: string) => void;
  onClose: () => void;
}

const MAX_NAME_LENGTH = 24;

const RenameModal: FC<RenameModalProps> = ({
  show,
  initialName,
  emoji,
  onSave,
  onClose,
}) => {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (show) {
      setValue(initialName);
      // Auto-focus the input on open + select all so the user
      // can either type a fresh name (replaces selection) or
      // edit the existing one.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [show, initialName]);

  if (!show) return null;

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_NAME_LENGTH;
  const tooShort = trimmed.length === 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 400,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 24,
          padding: 24,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          fontFamily: "Fredoka, system-ui, sans-serif",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "#3D2C1E",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "1.6rem", marginRight: 8 }}>{emoji || "💨"}</span>
          Rename this sound
        </h2>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="My Sound"
          aria-label="New name for this sound"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !tooLong && !tooShort) {
              onSave(trimmed);
            }
            if (e.key === "Escape") {
              onClose();
            }
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 16px",
            borderRadius: 12,
            border: tooLong || tooShort
              ? "2px solid #DC2626"
              : "2px solid #E5E0D5",
            fontSize: "1.1rem",
            fontFamily: "Fredoka, system-ui, sans-serif",
            color: "#3D2C1E",
            outline: "none",
            transition: "border-color 200ms ease",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: tooLong || tooShort ? "#DC2626" : "#92705A",
          }}
        >
          <span>
            {tooShort
              ? "Pick a name"
              : tooLong
                ? `Too long (max ${MAX_NAME_LENGTH})`
                : "Tap Enter to save"}
          </span>
          <span>
            {trimmed.length}/{MAX_NAME_LENGTH}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 16,
              background: "transparent",
              color: "#92705A",
              border: "2px solid #E5E0D5",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(trimmed)}
            disabled={tooLong || tooShort}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 16,
              background: tooLong || tooShort ? "#E5E0D5" : "#F59E0B",
              color: "white",
              border: "none",
              cursor: tooLong || tooShort ? "not-allowed" : "pointer",
              fontSize: "0.95rem",
              fontWeight: 700,
              fontFamily: "inherit",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;
