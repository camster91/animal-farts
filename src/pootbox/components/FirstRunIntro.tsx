// FirstRunIntro — crisp 3-step FTUE walkthrough for core features.
// Steps: Tap to play → Change & record → private sharing.
// Persisted via pootbox-firstrun-done (same key Settings can reset).

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface FirstRunIntroProps {
  show: boolean;
  onDone: () => void;
}

const STEPS = [
  {
    icon: "🎵",
    title: "Tap to play",
    body: "Every card is a sound. Tap one — hear the animal (or the fart).",
  },
  {
    icon: "🎤",
    title: "Make it yours",
    body: "Change any card’s sound, or record your own with the mic.",
  },
  {
    icon: "🔗",
    title: "Share with friends",
    body: "Ask a grown-up to help swap a private share code with someone you know.",
  },
] as const;

export default function FirstRunIntro({ show, onDone }: FirstRunIntroProps) {
  const [step, setStep] = useState(0);
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isLast = step >= STEPS.length - 1;
  const current = STEPS[step];

  const finish = useCallback(() => {
    setStep(0);
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!show) return;
    // Focus primary CTA when the walkthrough opens / step changes.
    const t = window.setTimeout(() => primaryRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [show, step]);

  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, finish]);

  if (!show) return null;

  function goNext() {
    if (isLast) finish();
    else setStep((s) => s + 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="pb-enter"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61, 44, 30, 0.55)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "var(--pb-surface)",
          borderRadius: 24,
          padding: "28px 24px 20px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 56px rgba(61, 44, 30, 0.28)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          fontFamily: "Fredoka, system-ui, sans-serif",
          border: "1px solid var(--pb-border)",
        }}
      >
        {/* Progress dots */}
        <div
          role="tablist"
          aria-label="Onboarding steps"
          style={{ display: "flex", gap: 8, marginBottom: 4 }}
        >
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1} of ${STEPS.length}`}
              onClick={() => setStep(i)}
              className="pb-hit"
              style={{
                width: i === step ? 22 : 10,
                height: 10,
                borderRadius: 999,
                border: "none",
                padding: 0,
                background: i === step ? "var(--pb-accent)" : "var(--pb-border-strong)",
                transition: "width 200ms ease, background 200ms ease",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <div
          key={step}
          className="pb-enter"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            width: "100%",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: "var(--pb-accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              lineHeight: 1,
            }}
          >
            {current.icon}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--pb-muted)",
            }}
          >
            Step {step + 1} of {STEPS.length}
          </p>

          <h2
            id={titleId}
            style={{
              margin: 0,
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "var(--pb-ink)",
              textAlign: "center",
            }}
          >
            {current.title}
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: "1.02rem",
              color: "var(--pb-muted)",
              textAlign: "center",
              lineHeight: 1.45,
              maxWidth: 300,
            }}
          >
            {current.body}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            width: "100%",
            marginTop: 8,
          }}
        >
          {!isLast && (
            <button
              type="button"
              onClick={finish}
              className="pb-hit"
              style={{
                appearance: "none",
                border: "2px solid var(--pb-border-strong)",
                cursor: "pointer",
                flex: "0 0 auto",
                minWidth: 88,
                minHeight: 48,
                padding: "12px 16px",
                borderRadius: 16,
                background: "transparent",
                color: "var(--pb-muted)",
                fontSize: "1rem",
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              Skip
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={goNext}
            className="pb-hit"
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              flex: 1,
              minHeight: 48,
              padding: "12px 16px",
              borderRadius: 16,
              background: "var(--pb-accent)",
              color: "var(--pb-accent-ink)",
              fontSize: "1.08rem",
              fontWeight: 700,
              fontFamily: "inherit",
              boxShadow: "0 4px 0 rgba(180, 100, 10, 0.35)",
            }}
          >
            {isLast ? "Let’s go!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
