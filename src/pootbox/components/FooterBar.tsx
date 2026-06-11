import type { ReactNode } from "react";

interface FooterBarProps {
  installBanner?: ReactNode;
  updateBanner?: ReactNode;
}

export default function FooterBar({ installBanner, updateBanner }: FooterBarProps) {
  if (!installBanner && !updateBanner) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "white",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {installBanner}
      {updateBanner}
    </div>
  );
}
