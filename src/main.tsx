import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { captureInstallPrompt } from "./pwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for offline use + push
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Surface state for debug + enable update detection
        (window as any).__swReg = reg;
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn("SW reg failed:", err));
  });
}

// PWA install prompt capture (Android Chrome)
captureInstallPrompt();

// Expose audio state getter for QA verification
import { getAudioState } from "./audio/fartEngine";
(window as any).__fartState = getAudioState;
