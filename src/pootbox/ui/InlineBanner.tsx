// InlineBanner — accessible inline error/info feedback (replaces raw red text / alerts).

import type { ReactNode } from "react";

export type BannerVariant = "error" | "info" | "success";

interface InlineBannerProps {
  message: string;
  variant?: BannerVariant;
  onDismiss?: () => void;
  action?: ReactNode;
}

const STYLES: Record<BannerVariant, { bg: string; fg: string; border: string }> = {
  error: { bg: "rgba(224, 122, 95, 0.12)", fg: "#7A2E2A", border: "rgba(224, 122, 95, 0.45)" },
  info: { bg: "rgba(245, 158, 11, 0.12)", fg: "#5C3D12", border: "rgba(245, 158, 11, 0.4)" },
  success: { bg: "rgba(74, 140, 90, 0.12)", fg: "#1F4D2A", border: "rgba(74, 140, 90, 0.4)" },
};

export default function InlineBanner({
  message,
  variant = "error",
  onDismiss,
  action,
}: InlineBannerProps) {
  const s = STYLES[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className="pb-enter"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        margin: "0 16px 12px",
        padding: "12px 14px",
        borderRadius: 14,
        background: s.bg,
        color: s.fg,
        border: `1.5px solid ${s.border}`,
        fontSize: "0.92rem",
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="pb-hit"
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
            padding: 4,
            margin: -4,
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
