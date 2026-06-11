import type { FC } from "react";
import { useState, useRef, useCallback } from "react";
import type { Page } from "../types";

interface PageTabsProps {
  pages: Page[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage?: () => void;
  onRenamePage?: (pageId: string, newName: string, newEmoji: string) => void;
  onDeletePage?: (pageId: string) => void;
  canDelete?: boolean; // true when more than 1 page exists
}

const QUICK_EMOJIS = ["🏠", "⭐", "🌙", "💩", "🐾"];

const PageTabs: FC<PageTabsProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  canDelete,
}) => {
  const canAddMore = pages.length < 6;

  // --- Action sheet state ---
  const [sheetPage, setSheetPage] = useState<Page | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Long-press tracking via pointer events ---
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const openSheet = useCallback((page: Page) => {
    setSheetPage(page);
    setSheetName(page.name);
    setShowDeleteConfirm(false);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetPage(null);
    setShowDeleteConfirm(false);
  }, []);

  const handlePointerDown = useCallback(
    (page: Page, e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerStart.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = setTimeout(() => {
        //800ms elapsed with no movement → long press fires
        openSheet(page);
        pointerStart.current = null;
      }, 800);
    },
    [openSheet]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || !longPressTimer.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      // Moved > 10px → cancel long press
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      pointerStart.current = null;
    }
  }, []);

  const handlePointerUp = useCallback(
    (page: Page, e: React.PointerEvent) => {
      if (longPressTimer.current) {
        // Fired before 800ms → treat as regular click
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        pointerStart.current = null;
        onSelectPage(page.id);
      }
    },
    [onSelectPage]
  );

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      pointerStart.current = null;
    }
  }, []);

  // Touch equivalents (same logic, touch events)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback(
    (page: Page, e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
      touchTimer.current = setTimeout(() => {
        openSheet(page);
        touchStart.current = null;
      }, 800);
    },
    [openSheet]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current || !touchTimer.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
      touchStart.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (page: Page) => {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
        touchStart.current = null;
        onSelectPage(page.id);
      }
    },
    [onSelectPage]
  );

  // --- Rename ---
  const handleSaveName = useCallback(() => {
    if (!sheetPage) return;
    onRenamePage(sheetPage.id, trimName(sheetName), sheetPage.emoji);
    closeSheet();
  }, [sheetPage, sheetName, onRenamePage, closeSheet]);

  const handleEmojiPick = useCallback(
    (emoji: string) => {
      if (!sheetPage) return;
      onRenamePage(sheetPage.id, sheetPage.name, emoji);
      closeSheet();
    },
    [sheetPage, onRenamePage, closeSheet]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!sheetPage) return;
    onDeletePage(sheetPage.id);
    closeSheet();
  }, [sheetPage, onDeletePage, closeSheet]);

  // --- Render ---
  return (
    <>
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
              onPointerDown={(e) => handlePointerDown(page, e)}
              onPointerUp={(e) => handlePointerUp(page, e)}
              onPointerMove={handlePointerMove}
              onPointerCancel={handlePointerCancel}
              onTouchStart={(e) => handleTouchStart(page, e)}
              onTouchEnd={() => handleTouchEnd(page)}
              onTouchMove={handleTouchMove}
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
            onClick={onAddPage}
            disabled={pages.length >= 6}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              cursor: pages.length >= 6 ? "not-allowed" : "pointer",
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

      {/* Action sheet modal */}
      {sheetPage && (
        <div
          onClick={closeSheet}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 20,
              padding: "24px 20px 20px",
              width: 280,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              fontFamily: "'Fredoka', sans-serif",
              color: "#3D2C1E",
              position: "relative",
            }}
          >
            {/* Close button */}
            <button
              onClick={closeSheet}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#3D2C1E",
                padding: 4,
                lineHeight: 1,
              }}
            >
              ✕
            </button>

            {/* Title */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              {sheetPage.name}
            </div>

            {/* Rename section */}
            <div style={{ marginBottom: 14 }}>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                maxLength={24}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1.5px solid #d4c4b0",
                  fontSize: 15,
                  color: "#3D2C1E",
                  outline: "none",
                  marginBottom: 8,
                  fontFamily: "'Fredoka', sans-serif",
                }}
              />
              <button
                onClick={handleSaveName}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 10,
                  border: "none",
                  background: "#3D2C1E",
                  color: "white",
                  fontSize: 15,
                  cursor: "pointer",
                  fontFamily: "'Fredoka', sans-serif",
                }}
              >
                Save name
              </button>
            </div>

            {/* Emoji section */}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiPick(emoji)}
                  aria-label={`Change emoji to ${emoji}`}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: "1.5px solid #d4c4b0",
                    background: "white",
                    fontSize: 20,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div
              style={{
                borderTop: "1px solid #e8ddd0",
                marginBottom: 14,
              }}
            />

            {/* Delete section */}
            <div>
              {!canDelete ? (
                <button
                  disabled
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 10,
                    border: "none",
                    background: "#e0d6cc",
                    color: "#a09080",
                    fontSize: 15,
                    cursor: "not-allowed",
                    fontFamily: "'Fredoka', sans-serif",
                  }}
                >
                  Can't delete your only page
                </button>
              ) : showDeleteConfirm ? (
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      textAlign: "center",
                      marginBottom: 8,
                      color: "#3D2C1E",
                    }}
                  >
                    Delete "{sheetPage.name}"? Can't be undone.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 10,
                        border: "1.5px solid #d4c4b0",
                        background: "white",
                        color: "#3D2C1E",
                        fontSize: 15,
                        cursor: "pointer",
                        fontFamily: "'Fredoka', sans-serif",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteConfirm}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 10,
                        border: "none",
                        background: "#c0392b",
                        color: "white",
                        fontSize: 15,
                        cursor: "pointer",
                        fontFamily: "'Fredoka', sans-serif",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 10,
                    border: "none",
                    background: "#c0392b",
                    color: "white",
                    fontSize: 15,
                    cursor: "pointer",
                    fontFamily: "'Fredoka', sans-serif",
                  }}
                >
                  Delete page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PageTabs;

// --- Pure helpers (exported for unit testing) ---

export function shouldTriggerLongPress(
  durationMs: number,
  movedPx: number
): boolean {
  return durationMs >= 800 && movedPx < 10;
}

export function trimName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Page";
  return trimmed.slice(0, 24);
}
