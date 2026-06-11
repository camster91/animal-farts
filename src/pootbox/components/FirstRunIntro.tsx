interface FirstRunIntroProps {
  show: boolean;
  onDone: () => void;
}

export default function FirstRunIntro({ show, onDone }: FirstRunIntroProps) {
  if (!show) return null;

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
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
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
        }}
      >
        <div style={{ fontSize: 80, lineHeight: 1 }}>🐄</div>

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
          Tap a sound to start
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
