import { useState, useEffect } from "react";

interface ShareSheetProps {
  mode: "share" | "lookup";
  pageName: string;
  onClose: () => void;
  onGenerateCode?: () => Promise<string>;
  onCopyCode?: (code: string) => void;
  onLookupCode?: (code: string) => Promise<{ name: string; bubbles: { emoji: string }[] } | null>;
  onAddAsPage?: (data: { name: string; bubbles: { emoji: string }[] }) => void;
}

export default function ShareSheet({
  mode,
  pageName,
  onClose,
  onGenerateCode,
  onCopyCode,
  onLookupCode,
  onAddAsPage,
}: ShareSheetProps) {
  const [code, setCode] = useState<string | null>(null);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ name: string; bubbles: { emoji: string }[] } | null>(null);
  const [lookupError, setLookupError] = useState(false);

  // share mode: generate code on mount
  useEffect(() => {
    if (mode === "share" && onGenerateCode) {
      onGenerateCode().then(setCode);
    }
  }, [mode, onGenerateCode]);

  function handleCopy() {
    if (code && onCopyCode) onCopyCode(code);
  }

  async function handleLookup() {
    const trimmed = lookupInput.trim().toUpperCase().slice(0, 4);
    if (trimmed.length < 4 || !onLookupCode) return;
    setLookupLoading(true);
    setLookupError(false);
    setLookupResult(null);
    try {
      const result = await onLookupCode(trimmed);
      setLookupResult(result);
      if (!result) setLookupError(true);
    } catch {
      setLookupError(true);
    } finally {
      setLookupLoading(false);
    }
  }

  function handleAddAsPage() {
    if (lookupResult && onAddAsPage) {
      onAddAsPage(lookupResult);
      onClose();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 150,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 24,
          padding: 24,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          fontFamily: "Fredoka, system-ui, sans-serif",
        }}
      >
        {mode === "share" ? (
          <>
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#3D2C1E",
                textAlign: "center",
              }}
            >
              Share "{pageName}"
            </h2>

            {code ? (
              <div
                style={{
                  fontSize: "3rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  color: "#3D2C1E",
                  marginBottom: 20,
                  fontWeight: 800,
                }}
              >
                {code}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "3rem",
                  fontFamily: "monospace",
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  color: "#92705A",
                  marginBottom: 20,
                }}
              >
                ....
              </div>
            )}

            <button
              onClick={handleCopy}
              style={{
                appearance: "none",
                border: "none",
                cursor: "pointer",
                width: "100%",
                padding: "12px 0",
                borderRadius: 16,
                background: "#F59E0B",
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                fontFamily: "inherit",
                marginBottom: 12,
              }}
            >
              Copy code
            </button>

            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#92705A",
                textAlign: "center",
              }}
            >
              Anyone with this code can add "{pageName}" to their pages
</p>
          </>
        ) : (
          <>
            <h2
              style={{
                margin: "0 0 20px",
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#3D2C1E",
                textAlign: "center",
              }}
            >
              Load a shared page
            </h2>

            <input
              type="text"
              placeholder="Enter 4-letter code"
              value={lookupInput}
              onChange={(e) =>
                setLookupInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))
              }
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "2px solid #E5E0D5",
                fontSize: "1.2rem",
                fontFamily: "monospace",
                letterSpacing: "0.3em",
                textAlign: "center",
                color: "#3D2C1E",
                boxSizing: "border-box",
                marginBottom: 12,
                outline: "none",
              }}
            />

            <button
              onClick={handleLookup}
              disabled={lookupInput.trim().length < 4 || lookupLoading}
              style={{
                appearance: "none",
                border: "none",
                cursor: lookupInput.trim().length < 4 ? "default" : "pointer",
                width: "100%",
                padding: "12px 0",
                borderRadius: 16,
                background: lookupInput.trim().length < 4 ? "#E5E0D5" : "#F59E0B",
                color: "white",
                fontSize: "1rem",
                fontWeight: 700,
                fontFamily: "inherit",
                marginBottom: 12,
              }}
            >
              {lookupLoading ? "Looking up..." : "Look up"}
            </button>

            {lookupError && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "0.85rem",
                  color: "#DC2626",
                  textAlign: "center",
                }}
              >
                Code not found
              </p>
            )}

            {lookupResult && (
              <div
                style={{
                  background: "#F9F7F2",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#3D2C1E",
                  }}
                >
                  {lookupResult.name}
                </p>
                <p style={{ margin: 0, fontSize: "1.4rem" }}>
                  {lookupResult.bubbles.map((b) => b.emoji).join(" ")}
                </p>
              </div>
            )}

            {lookupResult && (
              <button
                onClick={handleAddAsPage}
                style={{
                  appearance: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  padding: "12px 0",
                  borderRadius: 16,
                  background: "#F59E0B",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Add as new page
              </button>
            )}
          </>
        )}

        <button
          onClick={onClose}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            background: "transparent",
            color: "#92705A",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            marginTop: 8,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
