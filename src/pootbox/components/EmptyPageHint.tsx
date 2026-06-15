interface EmptyPageHintProps {
  show: boolean;
}

// v62: this hint is a dead code path — the v61 default page
// shows all 30 built-in sounds, so the page is never empty.
// PootBox.tsx still gates the conditional so it renders for
// non-default pages that the kid wipes empty. The copy is
// updated for the v62 card-grid affordance: the dashed-border
// + card at the end of the grid is the entry point (not a
// floating + button as in v46).
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
        ＋
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
        Tap the + card at the end of the row to add a sound
      </span>
    </div>
  );
}
