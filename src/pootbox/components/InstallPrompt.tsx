import { useState, useEffect, useRef } from "react";

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const deferredEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if dismissed within last 7 days
    try {
      const dismissed = localStorage.getItem("pootbox-install-dismissed");
      if (dismissed) {
        const age = Date.now() - Number(dismissed);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (age < sevenDays) return;
      }
    } catch {
      // localStorage unavailable — skip
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredEventRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    const installedHandler = () => {
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    const event = deferredEventRef.current;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setVisible(false);
    deferredEventRef.current = null;
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem("pootbox-install-dismissed", String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: 60,
        background: "rgba(0,0,0,0.85)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        zIndex: 2000,
        fontFamily: "Fredoka, system-ui, sans-serif",
        fontSize: "1rem",
        padding: "0 16px",
        boxSizing: "border-box",
      }}
    >
      <span>📱 Add PootBox to your home screen</span>
      <button
        onClick={handleInstall}
        style={{
          background: "#4D96FF",
          color: "white",
          border: "none",
          borderRadius: 16,
          padding: "6px 16px",
          fontSize: "0.9rem",
          fontFamily: "Fredoka, system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          color: "rgba(255,255,255,0.7)",
          border: "none",
          fontSize: "0.85rem",
          fontFamily: "Fredoka, system-ui, sans-serif",
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Not now
      </button>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  readonly platform: string;
  readonly platforms: string[];
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}