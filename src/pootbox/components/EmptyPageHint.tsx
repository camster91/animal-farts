import EmptyState from "../ui/EmptyState";

interface EmptyPageHintProps {
  show: boolean;
}

// Shown when a page has zero cards. Points kids at the + add card.
export default function EmptyPageHint({ show }: EmptyPageHintProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        paddingBottom: 80,
      }}
    >
      <EmptyState
        icon="＋"
        title="No sounds yet"
        body="Tap the + card at the end of the row to add a sound."
      />
    </div>
  );
}
