// FirstRunIntro.tsx — v69 modal for the first-launch welcome.
// Rendered by PootBox when pootbox-firstrun-done is missing
// from localStorage. Single "Let's go!" button calls onDone,
// which sets the localStorage flag + hides the modal.
//
// v80: explicit pointerEvents: "auto" on the overlay (was the
// default but now pinned for safety), and a click-anywhere-on-
// backdrop-to-dismiss affordance (in case the button itself is
// being intercepted somehow — the kid can tap outside the card
// to dismiss the modal). The previous render worked in dev but
// users reported clicks not landing in production.

interface FirstRunIntroProps {
  show: boolean;
  onDone: () => void;
}

export default function FirstRunIntro({ show, onDone }: FirstRunIntroProps) {
  if (!show) return null;

  return (
    <div
      onClick={onDone}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to PootBox"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
        pointerEvents: "auto",
        cursor: "pointer",
      }}
    >
      <div
        // v80: stopPropagation so clicking the card itself
        // doesn't bubble up to the overlay's onClick. The
        // overlay's onClick is the "tap outside the card to
        // dismiss" affordance — both paths dismiss.
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 24,
          padding: 32,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          fontFamily: "Fredoka, system-ui, sans-serif",
          cursor: "auto",
        }}
      >
        <div style={{ fontSize: 80, lineHeight: 1 }}>💨</div>

        <h2
          style={{
            margin: 0,
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "#3D2C1E",
            textAlign: "center",
          }}
        >
          👋 Welcome to PootBox
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: "1rem",
            color: "#92705A",
            textAlign: "center",
          }}
        >
          Tap any card to hear its sound. Tap the ✎ to change it, or the + to add a new one.
        </p>

        <button
          onClick={onDone}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            padding: "14px 0",
            borderRadius: 16,
            background: "#F59E0B",
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 700,
            fontFamily: "inherit",
            marginTop: 8,
          }}
        >
          Let's go!
        </button>
      </div>
    </div>
  );
}