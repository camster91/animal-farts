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

// Register service worker for offline use
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        (window as any).__swReg = reg;
        reg.update().catch(() => {});
      })
      .catch((err) => console.warn("SW reg failed:", err));
  });
}

// PWA install prompt capture (Android Chrome)
captureInstallPrompt();
