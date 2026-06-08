import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initErrorReporter } from "./lib/errorReporter.ts";
import { installAudioPrime } from "./audio/primeAudio.ts";

// v30: iOS Safari audio priming — installed at the absolute top of the
// app lifecycle so the first user gesture (welcome tap, profile tap,
// etc.) unlocks the audio pipeline before any React tree mounts.
installAudioPrime();

// v29: self-hosted error monitoring (10% sample, strips PII)
initErrorReporter();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register the offline-first service worker.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW reg failed:", err);
    });
  });
}
