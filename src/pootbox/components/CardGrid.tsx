// CardGrid.tsx — v61 "simple" mode main view.
//
// Replaces the physics-based BubbleCanvas with a static grid of
// cards. Each card shows the emoji + the sound name, plus a small
// "change sound" pencil icon. Tap a card to play its sound. Tap the
// pencil to swap the sound via the SoundPicker. There's a single
// "+ Add sound" card at the end of the grid that opens the picker
// to add a new card.
//
// The physics + drag + collision behavior is GONE in v61. The
// SingleVoice policy from audioManager still applies: tapping a
// different card stops the previous sound first.
//
// "Simple and fun" — no settings in the visible chrome (gear icon
// top-right opens SettingsModal as a sheet), no page tabs (single
// page in v61; if a kid wants more cards they tap "+ Add sound"
// and pick from the library).

import type { FC } from "react";
import type { BubbleState, BuiltInSound } from "../types";

interface CardGridProps {
  bubbles: BubbleState[];
  builtInSounds: BuiltInSound[];
  reducedMotion: boolean;
  /** Currently-playing bubble id, polled from useSoundPlaying.
   *  Used to render a "playing" pulse on the matching card. */
  playingBubbleId: string | null;
  /** v69: map of bubbleId → friendly name for custom
   *  recordings. The card label uses this map first, then
   *  falls back to the bubble's `name` field (built-in) or
   *  "My Sound" (custom, no name). Updated when the user
   *  renames a card via the RenameModal. */
  customNames?: Map<string, string>;
  onTapBubble: (id: string, clientX: number, clientY: number) => void;
  onChangeSound: (bubbleId: string) => void;
  /** v69: open the rename modal for a custom card. Only
   *  called on custom cards. */
  onRenameCard?: (bubbleId: string) => void;
  onAddCard: () => void;
  /** Called when the kid taps the small "delete" button on a
   *  custom-recorded card. Built-in cards can't be deleted
   *  (changing their sound is the equivalent — kid can swap
   *  to any other built-in or record their own over). */
  onDeleteCard?: (bubbleId: string) => void;
}

const CardGrid: FC<CardGridProps> = ({
  bubbles,
  builtInSounds,
  reducedMotion,
  playingBubbleId,
  customNames,
  onTapBubble,
  onChangeSound,
  onRenameCard,
  onAddCard,
  onDeleteCard,
}) => {
  // Build a lookup: bubbleId → builtInKey (for the "Animal"/"Fart"
  // label under the emoji). The "Fart" label is shown in a slightly
  // different color (it's the headline category for the app) but
  // we keep all sound names plain English.
  const soundKeyToBuiltIn: Map<string, BuiltInSound> = new Map();
  for (const s of builtInSounds) soundKeyToBuiltIn.set(s.key, s);

  function cardLabel(b: BubbleState): { name: string; isFart: boolean } {
    if (b.type === "built-in" && b.builtinKey) {
      const meta = soundKeyToBuiltIn.get(b.builtinKey);
      if (meta) return { name: meta.name, isFart: meta.bucket === "fart" };
    }
    if (b.type === "custom") {
      // v69: use the per-recording name from the localStorage
      // map (the friendly name the user typed), defaulting to
      // "My Sound" if the user hasn't renamed yet.
      const custom = customNames?.get(b.id);
      return { name: custom || "My Sound", isFart: false };
    }
    return { name: "Sound", isFart: false };
  }

  // v69: tap animation handled via the CSS :active pseudo-class
  // (no React state needed). The card's transform scales down
  // when the kid presses it, then snaps back when released.
  // It's pure-CSS so there's no React re-mount, no race
  // condition, and the animation fires every time without
  // any state machinery. Suppressed under reduced-motion via
  // the .reduce-motion class on the outer CardGrid wrapper.

  function handleCardTap(b: BubbleState, e: React.MouseEvent<HTMLButtonElement>) {
    try { navigator.vibrate(20); } catch { /* ignore */ }
    // The bubble owns the audio — but to avoid a stack of audioManager
    // calls, route through the same path as BubbleCanvas did. The
    // parent has a `onTapBubble` callback that fires handleBubbleTap
    // which has the playing-bubble branch.
    onTapBubble(b.id, e.clientX, e.clientY);
  }

  function handleCardDelete(b: BubbleState, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onDeleteCard?.(b.id);
  }

  // Inline styles here (no Tailwind) — the rest of the
  // app uses inline styles too (e.g. PootBox, SoundLibrary, etc.).
  function renderCard(b: BubbleState) {
    const isPlaying = playingBubbleId === b.id;
    const isCustom = b.type === "custom";
    const { name, isFart } = cardLabel(b);
    return (
      <button
        key={b.id}
        className="pootbox-card"
        data-bubble-id={b.id}
        onClick={(e) => handleCardTap(b, e)}
        aria-label={`${name} — tap to play${isPlaying ? " (playing — tap to stop)" : ""}`}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 12,
          minHeight: 124,
          borderRadius: 20,
          background: isPlaying
            ? "rgba(245, 158, 11, 0.18)"
            : "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: isPlaying
            ? "0 0 0 3px rgba(245,158,11,0.85), 0 4px 16px rgba(245,158,11,0.25)"
            : "0 4px 14px rgba(0,0,0,0.10)",
          border: "none",
          cursor: "pointer",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTapHighlightColor: "transparent",
          paddingBottom: 36, // extra room for the bottom action bar
          // The transform transition is set in the <style> block
          // above (.pootbox-card) so the :active state can override
          // it. Inline `transition` here would win specificity.
          animation: isPlaying && !reducedMotion
            ? "pootbox-card-playing 1.2s ease-in-out infinite"
            : "none",
        }}
      >
        <span
          style={{
            fontSize: 56,
            lineHeight: 1,
            // The fart-color tint is a tiny touch but the kids
            // notice it. Pink for farts, default for everything else.
            filter: isFart ? "drop-shadow(0 2px 4px rgba(244,114,182,0.4))" : "none",
          }}
        >
          {b.emoji}
        </span>
        <span
          style={{
            fontFamily: "Fredoka, system-ui, sans-serif",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: isFart ? "#BE185D" : "#3D2C1E",
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          {name}
        </span>
        {/* v69: bottom action bar (rename + change-sound). Both
            are pill-shaped with a soft-white background so the
            kid can find them. Anchored at the bottom of the
            card. The delete (×) button is at the top-right (a
            red dot) — out of the way but still discoverable. */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
            padding: "0 4px",
          }}
        >
          {isCustom && onRenameCard && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameCard(b.id);
              }}
              aria-label={`Rename ${name}`}
              title="Rename"
              style={{
                width: 26,
                height: 22,
                borderRadius: 11,
                background: "rgba(255,255,255,0.95)",
                border: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                color: "#3D2C1E",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✎
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeSound(b.id);
            }}
            aria-label={`Change ${name} sound`}
            title="Change sound"
            style={{
              minWidth: 56,
              height: 22,
              borderRadius: 11,
              background: "rgba(255,255,255,0.95)",
              border: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
              color: "#3D2C1E",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "Fredoka, system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: "0 10px",
              lineHeight: 1,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Change
          </button>
        </div>
        {/* Delete button — only for custom (user-recorded) cards. */}
        {isCustom && onDeleteCard && (
          <button
            onClick={(e) => handleCardDelete(b, e)}
            aria-label={`Delete ${name}`}
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(220, 38, 38, 0.85)",
              border: "none",
              color: "white",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 72, // leave room for the new top bar (gear icon)
        left: 8,
        right: 8,
        bottom: 8,
        overflowY: "auto",
        // CSS grid: as many 124px columns as fit, min 100px. The
        // gap is small so the cards look like one big sheet, not
        // spaced out like Apple widgets.
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
        gap: 10,
        padding: "8px 0 24px",
        // The card is the touch target; the page itself doesn't
        // need to handle pointer events except for the gear icon
        // and any future backdrop. Setting touchAction: manipulation
        // disables the double-tap-to-zoom delay.
        touchAction: "manipulation",
      }}
    >
      <style>{`
        .pootbox-card {
          transition: transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1),
                      background 200ms ease,
                      box-shadow 200ms ease;
        }
        .pootbox-card:active:not(:disabled) {
          transform: scale(0.94) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .pootbox-card:active:not(:disabled) {
            transform: scale(1) !important;
          }
        }
      `}</style>
      {bubbles.map(renderCard)}
      {/* "+ Add sound" card. Dashed border, single big "+" emoji,
          anchored at the end of the grid. */}
      <button
        onClick={onAddCard}
        aria-label="Add a new sound card"
        data-add-card
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: 12,
          minHeight: 124,
          borderRadius: 20,
          background: "rgba(255, 255, 255, 0.4)",
          border: "2px dashed rgba(61,44,30,0.35)",
          cursor: "pointer",
          fontFamily: "Fredoka, system-ui, sans-serif",
          color: "#3D2C1E",
          fontSize: "0.85rem",
          fontWeight: 600,
          transition: reducedMotion ? "none" : "background 150ms ease",
        }}
      >
        <span style={{ fontSize: 44, lineHeight: 1 }}>＋</span>
        <span>Add sound</span>
      </button>
    </div>
  );
};

export default CardGrid;
