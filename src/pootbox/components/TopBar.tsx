import type { FC } from "react";
import type { Page } from "../types";
import PageTabs from "./PageTabs";

interface TopBarProps {
  pages: Page[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: (id: string, name: string, emoji: string) => void;
  onDeletePage: (id: string) => void;
  canDelete: boolean;
  volume: number;
  onVolumeClick: () => void;
  onShareClick: () => void;
  onAddSoundClick: () => void;
}

const TopBar: FC<TopBarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  canDelete,
  volume,
  onVolumeClick,
  onShareClick,
  onAddSoundClick,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "linear-gradient(180deg, #FEF3C7 0%, rgba(254, 243, 199, 0.6) 100%)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      {/* Left section: logo + wordmark + PageTabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "1.4rem" }}>💨</span>
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "#3D2C1E",
            marginLeft: 8,
          }}
        >
          PootBox
        </span>
        <div style={{ marginLeft: 8 }}>
          <PageTabs
            pages={pages}
            activePageId={activePageId}
            onSelectPage={onSelectPage}
            onAddPage={onAddPage}
            onRenamePage={onRenamePage}
            onDeletePage={onDeletePage}
            canDelete={canDelete}
          />
        </div>
      </div>

      {/* Right section: Volume, Share, Add sound */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          aria-label="Volume"
          onClick={onVolumeClick}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(61,44,30,0.75)",
            border: "none",
            cursor: "pointer",
            color: "white",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {volume > 0 ? "🔊" : "🔇"}
        </button>

        <button
          aria-label="Share page"
          onClick={onShareClick}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(61,44,30,0.75)",
            border: "none",
            cursor: "pointer",
            color: "white",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          🔗
        </button>

        <button
          aria-label="Add sound"
          onClick={onAddSoundClick}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(61,44,30,0.75)",
            border: "none",
            cursor: "pointer",
            color: "white",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default TopBar;
