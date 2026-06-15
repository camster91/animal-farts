import { useState, useEffect, useRef, type FC } from "react";
import type { BuiltInSound } from "../types";

interface SoundLibraryProps {
  builtInSounds: BuiltInSound[];
  alreadyAddedKeys: Set<string>;
  onPick: (sound: BuiltInSound) => void;
  onRecord: () => void; // v61: kid can record their own sound
  onClose: () => void;
}

/** Pure filter function */
function filterSounds(
  sounds: BuiltInSound[],
  search: string,
  bucket: string,
  subBucket: string
): BuiltInSound[] {
  const q = search.trim().toLowerCase();
  return sounds.filter((s) => {
    const matchSearch =
      q === "" || s.name.toLowerCase().includes(q) || s.key.toLowerCase().includes(q);
    const matchBucket =
      bucket === "all" || s.bucket === bucket;
    // v70: sub-bucket filter applies ONLY when the top-level
    // bucket is "fart". For "all" / "animal" / "silly", the
    // sub-bucket is ignored (the kid isn't filtering farts).
    const matchSub =
      bucket !== "fart" ||
      subBucket === "all" ||
      s.subBucket === subBucket;
    return matchSearch && matchBucket && matchSub;
  });
}

const COLS = 6;

const BUCKETS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Animals", value: "animal" },
  { label: "Farts", value: "fart" },
  { label: "Silly", value: "silly" },
];

// v70: fart sub-buckets. The second-tier chips appear ONLY
// when the Farts top-level filter is active.
const FART_SUBBUCKETS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Wet", value: "wet" },
  { label: "Dry", value: "dry" },
  { label: "Bubbly", value: "bubbly" },
  { label: "Squeaky", value: "squeaky" },
  { label: "Long", value: "long" },
  { label: "Echo", value: "echo" },
];

const SoundLibrary: FC<SoundLibraryProps> = ({
  builtInSounds,
  alreadyAddedKeys,
  onPick,
  onRecord,
  onClose,
}) => {
  const [searchRaw, setSearchRaw] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeBucket, setActiveBucket] = useState("all");
  // v70: active sub-bucket (only meaningful when activeBucket
  // === "fart"). Resets to "all" whenever the top-level bucket
  // changes (handled by the reset-on-close in onClose + the
  // filter chip's onClick).
  const [activeSubBucket, setActiveSubBucket] = useState("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 200ms debounce on search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchRaw);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchRaw]);

  const filtered = filterSounds(builtInSounds, debouncedSearch, activeBucket, activeSubBucket);

  const clearFilters = () => {
    setSearchRaw("");
    setDebouncedSearch("");
    setActiveBucket("all");
    setActiveSubBucket("all");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,44,30,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "white",
          }}
        >
          Pick a sound
        </h2>
        <button
          onClick={onClose}
          aria-label="Close library"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            cursor: "pointer",
            color: "white",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* v61: "Record your own" CTA at the top of the picker.
          Sits above the bucket chips so the kid sees it first
          (most of them will reach for the record button, not
          the filter buttons). */}
      <div style={{ padding: "10px 16px 0" }}>
        <button
          onClick={() => { onRecord(); }}
          aria-label="Record your own sound"
          style={{
            width: "100%",
            minHeight: 52,
            padding: "10px 16px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #F59E0B 0%, #FB923C 100%)",
            color: "white",
            border: "none",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: 700,
            fontFamily: "Fredoka, system-ui, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 2px 8px rgba(245,158,11,0.3)",
          }}
        >
          <span style={{ fontSize: 18 }}>🎤</span>
          <span>Record your own sound</span>
        </button>
      </div>

      {/* Category chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "12px 16px 0",
        }}
      >
        {BUCKETS.map(({ label, value }) => {
          const isActive = activeBucket === value;
          return (
            <button
              key={value}
              onClick={() => {
                setActiveBucket(value);
                // v70: when leaving the Farts top-level, reset
                // the sub-bucket to "all" so the next time the
                // kid opens Farts they start fresh.
                setActiveSubBucket("all");
              }}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 16,
                fontSize: "0.8rem",
                fontWeight: 600,
                fontFamily: "Fredoka, system-ui, sans-serif",
                cursor: "pointer",
                transition: "all 150ms ease",
                border: isActive ? "none" : "1px solid #E5E0D5",
                background: isActive ? "#F59E0B" : "transparent",
                color: isActive ? "#FFFFFF" : "#3D2C1E",
              }}
            >
              {label}
            </button>
          );
          })}
          </div>

          {/* v70: fart sub-buckets (Bubbly / Dry / Echo / Long /
          Squeaky / Wet). Rendered ONLY when the Farts top-level
          filter is active. Slightly smaller chips than the
          primary filter so the visual hierarchy is clear. */}
          {activeBucket === "fart" && (
          <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "8px 16px 0",
          }}
          >
          {FART_SUBBUCKETS.map(({ label, value }) => {
            const isActive = activeSubBucket === value;
            return (
              <button
                key={value}
                onClick={() => setActiveSubBucket(value)}
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 13,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  fontFamily: "Fredoka, system-ui, sans-serif",
                  cursor: "pointer",
                  transition: "all 150ms ease",
                  border: isActive
                    ? "none"
                    : "1px solid rgba(245,158,11,0.3)",
                  background: isActive
                    ? "rgba(245,158,11,0.85)"
                    : "transparent",
                  color: isActive ? "#FFFFFF" : "#92705A",
                }}
              >
                {label}
              </button>
            );
          })}
          </div>
          )}

      {/* Search input */}
      <div
        style={{
          position: "relative",
          margin: "10px 16px 0",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.9rem",
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          placeholder="Search sounds…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 38,
            paddingLeft: 36,
            paddingRight: searchRaw ? 36 : 12,
            borderRadius: 10,
            border: "1px solid #E5E0D5",
            background: "#FFFFFF",
            fontSize: "0.85rem",
            fontFamily: "Fredoka, system-ui, sans-serif",
            color: "#3D2C1E",
            outline: "none",
          }}
        />
        {searchRaw && (
          <button
            onClick={() => setSearchRaw("")}
            aria-label="Clear search"
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "#3D2C1E",
              padding: 4,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Grid / Empty state */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 10,
          alignContent: "start",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: `1 / -1`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              paddingTop: 48,
              color: "#3D2C1E",
            }}
          >
            <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>
              No sounds match
            </span>
            <button
              onClick={clearFilters}
              style={{
                background: "none",
                border: "1px solid #E5E0D5",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: "0.8rem",
                fontFamily: "Fredoka, system-ui, sans-serif",
                cursor: "pointer",
                color: "#3D2C1E",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((sound) => {
            const isAdded = alreadyAddedKeys.has(sound.key);
            return (
              <button
                key={sound.key}
                onClick={() => !isAdded && onPick(sound)}
                disabled={isAdded}
                aria-label={`${sound.name} sound${isAdded ? " (already added)" : ""}`}
                aria-disabled={isAdded}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "8px 4px",
                  borderRadius: 12,
                  background: isAdded ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: isAdded ? "not-allowed" : "pointer",
                  opacity: isAdded ? 0.4 : 1,
                  transition: "opacity 150ms ease",
                }}
              >
                <span style={{ fontSize: 28 }}>{sound.emoji}</span>
                <span
                  style={{
                    fontSize: "0.65rem",
                    color: isAdded ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
                    textAlign: "center",
                    lineHeight: 1.2,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sound.name}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SoundLibrary;
