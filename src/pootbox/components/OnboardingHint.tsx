import type { FC } from "react";
import { useEffect } from "react";

interface OnboardingHintProps {
  targetBubblePos: { x: number; y: number } | null;
  onDismiss: () => void;
}

const STORAGE_KEY = "pootbox-onboarded-v2";

const OnboardingHint: FC<OnboardingHintProps> = ({
  targetBubblePos,
  onDismiss,
}) => {
  // Already onboarded? Don't show.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* ignore */ }
  }, []);

  if (!targetBubblePos) return null;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        pointerEvents: "all",
        cursor: "pointer",
      }}
    >
      {/* Semi-transparent overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.25)",
        }}
      />

      {/* Hint card positioned near the target bubble */}
      <div
        style={{
          position: "absolute",
          left: targetBubblePos.x - 70,
          top: targetBubblePos.y + 56,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 16,
          padding: "12px 18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          fontFamily: "Fredoka, system-ui, sans-serif",
          animation: "pootbox-hint-bounce 1.2s ease-in-out infinite",
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>👆</span>
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            color: "#3D2C1E",
          }}
        >
          Tap a sound!
        </span>
      </div>

      <style>{`
        @keyframes pootbox-hint-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default OnboardingHint;