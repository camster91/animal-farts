import { useState, useEffect } from "react";

export default function UpdatePrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      // controllerchange fires when a new SW takes over
      setVisible(true);
    };

    navigator.serviceWorker.addEventListener("controllerchange", handler);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handler);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        background: "rgba(0,0,0,0.9)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        zIndex: 2000,
        fontFamily: "Fredoka, system-ui, sans-serif",
        fontSize: "0.95rem",
        padding: "10px 16px",
        boxSizing: "border-box",
      }}
    >
      <span>🆕 New version available</span>
      <button
        onClick={handleReload}
        style={{
          background: "#6BCB77",
          color: "white",
          border: "none",
          borderRadius: 16,
          padding: "5px 14px",
          fontSize: "0.9rem",
          fontFamily: "Fredoka, system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Reload
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          color: "rgba(255,255,255,0.6)",
          border: "none",
          fontSize: "0.85rem",
          fontFamily: "Fredoka, system-ui, sans-serif",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Later
      </button>
    </div>
  );
}