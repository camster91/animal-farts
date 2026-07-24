// Shared empty-state block — one job, one headline, one short line, optional CTA.

import type { CSSProperties, ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  style?: CSSProperties;
}

export default function EmptyState({ icon = "💨", title, body, action, style }: EmptyStateProps) {
  return (
    <div
      className="pb-enter"
      role="status"
      style={{
        textAlign: "center",
        padding: "40px 24px",
        color: "var(--pb-muted)",
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          fontSize: "2.75rem",
          lineHeight: 1,
          marginBottom: 12,
          filter: "grayscale(0.1)",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: "1.15rem",
          fontWeight: 700,
          color: "var(--pb-ink)",
        }}
      >
        {title}
      </h3>
      {body && (
        <p style={{ margin: "0 auto", maxWidth: 280, fontSize: "0.95rem", lineHeight: 1.45 }}>
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}
