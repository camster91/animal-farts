import type { SettingsModalProps } from "./types";

export default function SettingsModal({ settings, onChange, onClose }: SettingsModalProps) {
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
        zIndex: 100,
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
        }}
      >
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#3D2C1E",
          }}
        >
          💨 PootBox
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "0.85rem",
            color: "#92705A",
          }}
        >
          Parent settings (hidden)
        </p>

        <label style={{ display: "block", marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
              fontSize: "0.9rem",
              color: "#3D2C1E",
            }}
          >
            <span>Volume</span>
            <span style={{ fontFamily: "monospace" }}>
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(e) =>
              onChange({ ...settings, volume: parseFloat(e.target.value) })
            }
            style={{ width: "100%", accentColor: "#F59E0B" }}
          />
        </label>

        <label
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            padding: "8px 0",
          }}
        >
          <span style={{ fontSize: "0.9rem", color: "#3D2C1E" }}>Reduce motion</span>
          <button
            onClick={() => onChange({ ...settings, reducedMotion: !settings.reducedMotion })}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              width: 48,
              height: 28,
              borderRadius: 14,
              background: settings.reducedMotion ? "#F59E0B" : "#E5E0D5",
              position: "relative",
              transition: "background 200ms",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: settings.reducedMotion ? 22 : 2,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "white",
                transition: "left 200ms",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </label>

        <button
          onClick={onClose}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            padding: "12px 0",
            borderRadius: 16,
            background: "#F59E0B",
            color: "white",
            fontSize: "1rem",
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          Done
        </button>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: "0.7rem",
            color: "#92705A",
            textAlign: "center",
          }}
        >
          This menu only appears after holding the background for 5 seconds.
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#92705A", fontSize: "0.8rem", textDecoration: "underline" }}
          >
            Privacy
          </a>
          <a
            href="/about.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#92705A", fontSize: "0.8rem", textDecoration: "underline" }}
          >
            About
          </a>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("pootbox-firstrun-done");
                localStorage.removeItem("pootbox-onboarded-v1");
                localStorage.removeItem("pootbox-onboarded-v2");
              } catch { /* ignore */ }
              window.location.reload();
            }}
            style={{ color: "#92705A", fontSize: "0.8rem", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
          >
            Show welcome again
          </button>
        </div>
      </div>
    </div>
  );
}