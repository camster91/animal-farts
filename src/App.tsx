import { useState, useEffect, useCallback, useRef } from "react";
import {
  PRESETS,
  playFart,
  playUrl,
  stopAllSounds,
  startRecording,
  stopRecording,
  loadRecordings,
  saveRecording,
  deleteRecording,
  type FartPreset,
  type CustomRecording,
} from "./audio/fartEngine";

export default function App() {
  const [recordings, setRecordings] = useState<CustomRecording[]>(() => loadRecordings());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Clear the "active" highlight 250ms after a tap — gives the emoji a
  // brief pop on press. Visual feedback only; doesn't block any other tap.
  const activeTimer = useRef<number | null>(null);
  const flashActive = useCallback((id: string) => {
    setActiveId(id);
    if (activeTimer.current) window.clearTimeout(activeTimer.current);
    activeTimer.current = window.setTimeout(() => {
      setActiveId((cur) => (cur === id ? null : cur));
    }, 250);
  }, []);

  // Recording timer (counts up while recording).
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setRecordSeconds((s) => s + 0.1), 100);
    return () => window.clearInterval(id);
  }, [recording]);

  // Tap an animal — play its sound.
  const onTapAnimal = useCallback(
    (preset: FartPreset) => {
      void playFart(preset);
      flashActive(preset.id);
    },
    [flashActive]
  );

  // Tap a recording tile — play the Blob URL.
  const onTapRecording = useCallback(
    (rec: CustomRecording) => {
      void playUrl(rec.url);
      flashActive(rec.id);
    },
    [flashActive]
  );

  // Start/stop recording.
  const onToggleRecord = useCallback(async () => {
    if (recording) {
      const result = await stopRecording();
      setRecording(false);
      setRecordSeconds(0);
      if (result && result.duration > 0.2) {
        const rec = saveRecording({ url: result.url, duration: result.duration });
        setRecordings((cur) => [...cur, rec]);
      }
    } else {
      try {
        await startRecording();
        setRecording(true);
        setRecordSeconds(0);
      } catch (err: any) {
        console.warn("mic denied:", err?.message || err);
        alert("Need microphone permission to record.");
      }
    }
  }, [recording]);

  // Long-press a recording to delete it. We use a simple confirm() —
  // no custom modal UI, no share, no nothing.
  const onDeleteRecording = useCallback((id: string) => {
    if (!confirm("Delete this sound?")) return;
    deleteRecording(id);
    setRecordings((cur) => cur.filter((r) => r.id !== id));
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <header className="px-3 pt-3 pb-2 flex items-center justify-center max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900">💨 Animal Farts</h1>
      </header>

      {/* Main: recordings row (if any) + animal grid */}
      <main className="flex-1 px-3 pb-40 max-w-3xl mx-auto w-full">
        {recordings.length > 0 && (
          <>
            <h2 className="text-base font-bold text-purple-900 mt-2 mb-2 text-center">🎤 My sounds</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {recordings.map((rec) => (
                <RecordingTile
                  key={rec.id}
                  rec={rec}
                  active={activeId === rec.id}
                  onPlay={onTapRecording}
                  onDelete={onDeleteRecording}
                />
              ))}
            </div>
          </>
        )}

        <h2 className="text-base font-bold text-amber-900 mt-2 mb-2 text-center">🐾 Animals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <AnimalTile
              key={preset.id}
              preset={preset}
              active={activeId === preset.id}
              onPlay={onTapAnimal}
            />
          ))}
        </div>
      </main>

      {/* Action bar — record button + stop-all */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-white via-white/95 to-transparent"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2 max-w-3xl mx-auto">
          <button
            onClick={onToggleRecord}
            className={`flex-1 font-extrabold text-base py-4 rounded-2xl shadow-lg border-2 border-white active:scale-95 ${recording ? "bg-red-500 text-white" : "bg-gradient-to-br from-pink-500 to-purple-500 text-white"}`}
          >
            {recording ? `⏹  Stop (${recordSeconds.toFixed(1)}s)` : "🎤  Make a sound"}
          </button>
          {recordings.length > 0 && (
            <button
              onClick={stopAllSounds}
              className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-200 text-xl active:scale-95 flex items-center justify-center shadow"
              title="Stop all"
              aria-label="Stop all"
            >
              ⏹
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function AnimalTile({
  preset,
  active,
  onPlay,
}: {
  preset: FartPreset;
  active: boolean;
  onPlay: (p: FartPreset) => void;
}) {
  return (
    <button
      onClick={() => onPlay(preset)}
      style={{ touchAction: "manipulation" }}
      className={`relative aspect-square rounded-3xl bg-gradient-to-br ${preset.color} shadow-xl border-4 border-white/70 active:scale-95 select-none`}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none">
        <div className={`text-6xl sm:text-7xl ${active ? "scale-90" : ""} transition-transform`}>
          {preset.emoji}
        </div>
        <div className="mt-1 text-base sm:text-lg font-bold text-amber-950 drop-shadow truncate max-w-full">
          {preset.name}
        </div>
      </div>
    </button>
  );
}

function RecordingTile({
  rec,
  active,
  onPlay,
  onDelete,
}: {
  rec: CustomRecording;
  active: boolean;
  onPlay: (rec: CustomRecording) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={`relative aspect-square rounded-3xl bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 shadow-xl border-4 border-white active:scale-95 select-none transition-transform`}
    >
      <button
        onClick={() => onPlay(rec)}
        style={{ touchAction: "manipulation" }}
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2"
      >
        <div className={`text-6xl sm:text-7xl ${active ? "scale-90" : ""} transition-transform`}>💨</div>
        <div className="mt-1 text-sm font-bold text-purple-950">{rec.duration.toFixed(1)}s</div>
      </button>
      <button
        onClick={() => onDelete(rec.id)}
        aria-label="Delete"
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        ✕
      </button>
    </div>
  );
}
