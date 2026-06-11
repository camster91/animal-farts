import type { FC } from "react";
import { useState } from "react";

interface AddSoundMenuProps {
  onRecord: () => void;
  onPickFromLibrary: () => void;
  onAddNewPage: () => void;
  onOpenSettings: () => void;
  pagesCount: number;
  maxPages: number;
  show?: boolean;
  onShowChange?: (show: boolean) => void;
}

interface MenuOptionProps {
  emoji: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const MenuOption: FC<MenuOptionProps> = ({ emoji, label, onClick, disabled }) => (
  <button
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    aria-label={label}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      width: "100%",
      minHeight: 64,
      padding: "0 24px",
      background: "transparent",
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      fontSize: "1.05rem",
      fontFamily: "Fredoka, system-ui, sans-serif",
      color: disabled ? "#92705A" : "#3D2C1E",
      textAlign: "left",
      transition: "background 150ms ease",
    }}
    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(245,158,11,0.1)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
  >
    <span style={{ fontSize: "1.6rem", flexShrink: 0 }}>{emoji}</span>
    <span>{label}</span>
  </button>
);

const AddSoundMenu: FC<AddSoundMenuProps> = ({
  onRecord,
  onPickFromLibrary,
  onAddNewPage,
  onOpenSettings,
  pagesCount,
  maxPages,
  show,
  onShowChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = show !== undefined ? show : internalOpen;
  const setOpen = onShowChange !== undefined ? onShowChange : setInternalOpen;
  const canAddPage = pagesCount < maxPages;

  return (
    <>
      <button
        aria-label="Add sound"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 72,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(61,44,30,0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "none",
          cursor: "pointer",
          color: "white",
          fontSize: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          padding: 0,
        }}
      >
        +
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 300,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "24px 24px 0 0",
              padding: "16px 0 40px",
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "#E5E0D5",
              margin: "0 auto 16px",
            }} />

            <MenuOption emoji="🎙" label="Record your own sound" onClick={onRecord} />
            <MenuOption emoji="📚" label="Pick from the sound library" onClick={onPickFromLibrary} />
            <MenuOption emoji="➕" label="Add a new page" onClick={onAddNewPage} disabled={!canAddPage} />
            <MenuOption emoji="⚙️" label="Settings" onClick={onOpenSettings} />
          </div>
        </div>
      )}
    </>
  );
};

export default AddSoundMenu;