interface VolumeSliderProps {
  show: boolean;
  volume: number;
  onChange: (v: number) => void;
  position: { top: number; left: number };
}

export default function VolumeSlider({ show, volume, onChange, position }: VolumeSliderProps) {
  if (!show) return null;

  const isMuted = volume === 0;

  return (
    <div
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: 300,
        background: "white",
        borderRadius: 20,
        padding: "16px 20px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        zIndex: 300,
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => onChange(isMuted ? 1 : 0)}
          style={{
            appearance: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.5rem",
            background: "transparent",
            padding: 0,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            flex: 1,
            accentColor: "#F59E0B",
            height: 4,
          }}
        />

        <span
          style={{
            fontSize: "0.8rem",
            color: "#92705A",
            fontFamily: "monospace",
            minWidth: 36,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
