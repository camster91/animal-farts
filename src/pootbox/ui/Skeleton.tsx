// Skeleton loaders — shimmer placeholders for social fetches.

import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: number;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = 10, style }: SkeletonProps) {
  return (
    <div
      className="pb-skeleton"
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading feed" style={{ padding: "8px 16px 24px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="pb-enter"
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 16,
            background: "var(--pb-surface)",
            boxShadow: "var(--pb-shadow)",
            animationDelay: `${i * 60}ms`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Skeleton width={44} height={44} radius={22} />
            <div style={{ flex: 1 }}>
              <Skeleton width="46%" height={14} style={{ marginBottom: 8 }} />
              <Skeleton width="30%" height={11} />
            </div>
            <Skeleton width={88} height={36} radius={12} />
          </div>
          <Skeleton height={48} radius={12} style={{ marginBottom: 8 }} />
          <Skeleton height={48} radius={12} />
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" style={{ padding: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Skeleton width={80} height={80} radius={40} />
        <Skeleton width={140} height={18} />
        <Skeleton width={100} height={14} />
        <Skeleton width="80%" height={48} radius={14} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
}

export function CommentsSkeleton() {
  return (
    <div role="status" aria-label="Loading comments" style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "flex", gap: 10, animationDelay: `${i * 50}ms` }} className="pb-enter">
          <Skeleton width={36} height={36} radius={18} />
          <div style={{ flex: 1 }}>
            <Skeleton width="40%" height={12} style={{ marginBottom: 8 }} />
            <Skeleton width="90%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}
