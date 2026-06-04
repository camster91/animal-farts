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

        // If a new SW is already waiting (page was loaded after a deploy
        // but before the new SW was activated), reload to pick it up.
        if (reg.waiting) {
          (window as any).__swNewVersionReady = true;
          window.dispatchEvent(new CustomEvent("sw-new-version"));
        }

        // Watch for a newly installed SW finishing.
        reg.addEventListener("updatefound", () => {
          const newSw = reg.installing;
          if (!newSw) return;
          newSw.addEventListener("statechange", () => {
            if (newSw.state === "installed" && navigator.serviceWorker.controller) {
              (window as any).__swNewVersionReady = true;
              window.dispatchEvent(new CustomEvent("sw-new-version"));
            }
          });
        });
      })
      .catch((err) => console.warn("SW reg failed:", err));

    // When the new SW takes over (via skipWaiting), reload so the page
    // is running the new code. The reload happens once per controller change.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// PWA install prompt capture (Android Chrome)
captureInstallPrompt();
