// iOS Safari audio priming.
// Must be installed BEFORE the React tree mounts so the first user
// interaction (welcome screen tap, profile card tap, or any other tap)
// unlocks the audio pipeline.
//
// iOS Safari has an "autoplay policy" — HTMLAudioElement.play() and
// AudioContext.resume() will throw NotAllowedError until a user gesture
// has occurred. The warmup window is short (a few seconds) so we want
// the very first interaction to count, not a kid's first cow-tap
// (which may be seconds after the page loads and iOS has forgotten
// the gesture).
//
// Strategy:
//   1. Attach a one-time document-level pointerdown / touchstart /
//      keydown listener that runs the primer immediately.
//   2. The primer:
//        - creates an AudioContext (or webkitAudioContext)
//        - resumes it
//        - plays a tiny silent data: WAV to "warm up" the audio element
//          decoding pipeline
//   3. After priming, the listener removes itself.
//
// This is idempotent — safe to call multiple times.

let primed = false;
let installed = false;

function prime(): void {
  if (primed) return;
  primed = true;
  try {
    const W = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (Ctor) {
      const ctx = new Ctor();
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }
    }
    // Silent ~22-byte WAV header + a few zero samples. iOS Safari will
    // decode this and consider the audio pipeline "warm".
    const a = new Audio();
    a.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    a.play().catch(() => {});
  } catch {
    // ignore — priming is best-effort
  }
}

export function installAudioPrime(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const handler = () => {
    prime();
    document.removeEventListener("pointerdown", handler, true);
    document.removeEventListener("touchstart", handler, true);
    document.removeEventListener("keydown", handler, true);
  };

  // Capture phase so we run before any other handler that might
  // e.stopPropagation() and prevent the priming from firing.
  document.addEventListener("pointerdown", handler, { capture: true, once: true });
  document.addEventListener("touchstart", handler, { capture: true, once: true });
  document.addEventListener("keydown", handler, { capture: true, once: true });
}

// Test-only escape hatch (not used in production bundle).
export function _resetAudioPrimeForTests(): void {
  primed = false;
  installed = false;
}
