import type { FC } from "react";
import type { Page } from "../types";

interface PageTabsProps {
  pages: Page[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
}

const PageTabs: FC<PageTabsProps> = ({ pages, activePageId, onSelectPage }) => {
  const canAddMore = pages.length < 6;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(61,44,30,0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 999,
        padding: "6px 10px",
        zIndex: 200,
        overflowX: pages.length >= 4 ? "auto" : "visible",
        maxWidth: "100vw",
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      }}
    >
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        return (
          <button
            key={page.id}
            onClick={() => onSelectPage(page.id)}
            aria-label={`Page: ${page.name}`}
            aria-current={isActive ? "page" : undefined}
            style={{
              flexShrink: 0,
              width: isActive ? 40 : 36,
              height: isActive ? 40 : 36,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: isActive ? "white" : "rgba(255,255,255,0.15)",
              color: isActive ? "#3D2C1E" : "rgba(255,255,255,0.9)",
              fontSize: isActive ? 20 : 17,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms ease",
              padding: 0,
              boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {page.emoji}
          </button>
        );
      })}

      {canAddMore && (
        <button
          aria-label="Add new page"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.9)",
            fontSize: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            transition: "background 150ms ease",
          }}
        >
          +
        </button>
      )}
    </div>
  );
};

export default PageTabs;