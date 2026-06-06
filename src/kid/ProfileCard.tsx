// Poot Party — ProfileCard. v26d.
// A single profile card shown on the Home scene.

import type { Profile } from "./useKidStorage";

interface Props {
  profile: Profile;
  heardCount: number;
  onSelect: (profile: Profile) => void;
}

export function ProfileCard({ profile, heardCount, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(profile)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        background: "rgba(255,255,255,0.92)",
        borderRadius: 24,
        padding: "20px 16px 16px",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        minWidth: 100,
        maxWidth: 120,
        transition: "transform 120ms, box-shadow 120ms",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      onPointerDown={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
      }}
      onPointerUp={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      onPointerLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {/* Avatar */}
      <div
        style={{
          fontSize: 48,
          lineHeight: 1,
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#FFF0F5",
          border: "3px solid #FFD0D0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {profile.avatar}
      </div>

      {/* Name */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#1a1a1a",
          textAlign: "center",
          maxWidth: 90,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {profile.name}
      </span>

      {/* Heard count badge */}
      <div
        style={{
          background: "#FF6B6B",
          borderRadius: 12,
          padding: "3px 10px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          {heardCount} sounds
        </span>
      </div>
    </button>
  );
}