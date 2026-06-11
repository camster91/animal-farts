interface EmptyPageHintProps {
  show: boolean;
}

export default function EmptyPageHint({ show }: EmptyPageHintProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.8,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 12, opacity: 0.6 }}>
        ➕
      </div>
      <span
        style={{
          fontFamily: "Fredoka, system-ui, sans-serif",
          fontSize: "1.2rem",
          fontWeight: 600,
          color: "#3D2C1E",
          opacity: 0.7,
        }}
      >
        Tap + to add a sound
      </span>
    </div>
  );
}
