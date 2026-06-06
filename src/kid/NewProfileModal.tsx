// Poot Party — NewProfileModal. v26d.
// Modal for creating a new kid profile.

import { useState, useCallback } from "react";
import { EMOJI_GRID } from "./useEmojiGrid";
import type { Profile } from "./useKidStorage";

interface Props {
  onCreate: (profile: Profile) => void;
  onCancel: () => void;
}

export function NewProfileModal({ onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && avatar !== null;

  const handleCreate = useCallback(() => {
    if (!canCreate || !avatar) return;
    const profile: Profile = {
      id: `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      avatar,
      createdAt: Date.now(),
      lastSceneId: "farm",
    };
    onCreate(profile);
  }, [canCreate, avatar, name, onCreate]);

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
        <p
          style={{
            textAlign: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#1a1a1a",
            margin: 0,
          }}
        >
          Who's playing? 🎉
        </p>

        {/* Name input */}
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#666",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Your name:
          </p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Adelaide"
            maxLength={24}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              borderRadius: 14,
              border: "2.5px solid #e8e0d4",
              background: "#fff",
              fontSize: 16,
              fontWeight: 600,
              color: "#1a1a1a",
              outline: "none",
              fontFamily: "inherit",
              transition: "border 150ms",
            }}
            onFocus={e => {
              e.target.style.border = "2.5px solid #ff6b6b";
            }}
            onBlur={e => {
              e.target.style.border = "2.5px solid #e8e0d4";
            }}
          />
        </div>

        {/* Avatar picker */}
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#666",
              margin: "0 0 8px",
              textAlign: "center",
            }}
          >
            Pick your avatar:
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 4,
              maxHeight: 130,
              overflowY: "auto",
              padding: 4,
              background: "#f5f0e8",
              borderRadius: 16,
            }}
          >
            {EMOJI_GRID.map(emoji => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                style={{
                  fontSize: 22,
                  padding: "4px 2px",
                  border:
                    avatar === emoji
                      ? "3px solid #ff6b6b"
                      : "3px solid transparent",
                  borderRadius: 10,
                  background: avatar === emoji ? "#fff0f0" : "transparent",
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
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={canCreate ? handleCreate : undefined}
            disabled={!canCreate}
            style={{
              flex: 1,
              padding: "12px 8px",
              borderRadius: 16,
              border: "none",
              background: canCreate ? "#ff6b6b" : "#e0e0e0",
              color: canCreate ? "#fff" : "#aaa",
              fontWeight: 800,
              fontSize: 14,
              cursor: canCreate ? "pointer" : "not-allowed",
              boxShadow: canCreate ? "0 4px 16px rgba(255,107,107,0.35)" : "none",
              transition: "background 200ms, box-shadow 200ms",
              fontFamily: "inherit",
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}