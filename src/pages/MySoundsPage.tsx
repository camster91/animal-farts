import { useState, useEffect, useCallback, useRef } from "react";
import { api, audioUrl, type Recording, type User } from "../api";
import { playSound } from "../audio/fartEngine";
import { usePoof } from "../poofContext";

type LocalRecording = {
  id: string;
  url: string;       // blob: URL
  duration: number;
  createdAt: number;
  uploaded: boolean;
  uploadedId?: number;
  name?: string;
  emoji?: string;
};

const STORAGE_KEY = "emoji-farts-local-recordings";

function loadLocal(): LocalRecording[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}
function saveLocal(recs: LocalRecording[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recs));
}

export default function MySoundsPage({ me }: { me: User | null }) {
  const onPoof = usePoof();
  const [localRecs, setLocalRecs] = useState<LocalRecording[]>(loadLocal);
  const [uploaded, setUploaded] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<Set<string>>(new Set());

  // Pull pending recordings from localStorage (saved by SoundsPage when
  // a recording is made) and merge them into our local list.
  useEffect(() => {
    const refresh = () => {
      const pending = JSON.parse(localStorage.getItem("emoji-farts-pending") || "[]");
      if (pending.length === 0) return;
      // Move them to our list as "unuploaded"
      const newOnes: LocalRecording[] = pending.map((p: any) => ({
        id: p.id, url: p.url, duration: p.duration, createdAt: p.createdAt, uploaded: false,
      }));
      const merged = loadLocal().concat(newOnes);
      saveLocal(merged);
      localStorage.removeItem("emoji-farts-pending");
      setLocalRecs(merged);
    };
    refresh();
    window.addEventListener("emoji-farts:pending-changed", refresh);
    return () => window.removeEventListener("emoji-farts:pending-changed", refresh);
  }, []);

  // Fetch uploaded recordings from server
  useEffect(() => {
    if (!me) return;
    setLoading(true);
    api.listMyRecordings()
      .then((rs) => setUploaded(rs))
      .catch((e) => console.warn("[my] listMyRecordings:", e))
      .finally(() => setLoading(false));
  }, [me?.id, me?.handle]);

  // Auto-upload pending recordings (best-effort, in background)
  useEffect(() => {
    if (!me || !me.handle) return; // need a handle before we can upload
    const toUpload = localRecs.filter((r) => !r.uploaded);
    if (toUpload.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const rec of toUpload) {
        if (cancelled) return;
        if (uploading.has(rec.id)) continue;
        setUploading((s) => new Set(s).add(rec.id));
        try {
          const blob = await fetch(rec.url).then((r) => r.blob());
          const result = await api.uploadRecording(
            { name: rec.name || `My fart ${rec.id.slice(-4)}`, emoji: rec.emoji || "💨", durationSec: rec.duration, visibility: "public" },
            blob
          );
          if (cancelled) return;
          // Mark as uploaded locally
          const updated = localRecs.map((r) =>
            r.id === rec.id ? { ...r, uploaded: true, uploadedId: result.id, name: result.name, emoji: result.emoji } : r
          );
          saveLocal(updated);
          setLocalRecs(updated);
          // Refresh server list
          api.listMyRecordings().then(setUploaded).catch(() => {});
        } catch (err) {
          console.warn("[my] upload failed:", err);
        } finally {
          setUploading((s) => { const n = new Set(s); n.delete(rec.id); return n; });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.handle, localRecs.length]);

  // Tap to play
  const onPlay = useCallback((url: string, e: React.MouseEvent | React.TouchEvent) => {
    void playSound(url);
    const point = "touches" in e
      ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
      : (e as any);
    onPoof(point?.clientX ?? window.innerWidth / 2, point?.clientY ?? window.innerHeight / 2, "💨");
  }, [onPoof]);

  // Delete local + (if uploaded) server
  const onDelete = useCallback(async (rec: LocalRecording) => {
    if (!confirm("Delete this sound?")) return;
    if (rec.uploaded && rec.uploadedId) {
      try { await api.deleteRecording(rec.uploadedId); } catch {}
    }
    try { URL.revokeObjectURL(rec.url); } catch {}
    const next = localRecs.filter((r) => r.id !== rec.id);
    saveLocal(next);
    setLocalRecs(next);
    if (rec.uploaded) setUploaded((u) => u.filter((r) => r.id !== rec.uploadedId));
  }, [localRecs]);

  // Rename
  const onRename = useCallback((id: string, newName: string) => {
    const next = localRecs.map((r) => r.id === id ? { ...r, name: newName } : r);
    saveLocal(next);
    setLocalRecs(next);
  }, [localRecs]);

  if (!me) {
    return (
      <div className="px-4 py-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900 mb-2">🎤 My sounds</h1>
        <p className="text-slate-700">Pick a profile to save your recordings.</p>
      </div>
    );
  }

  if (!me.handle) {
    return (
      <div className="px-4 py-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900 mb-2">🎤 My sounds</h1>
        <p className="text-slate-700 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
          Pick a handle in your profile before you can save sounds.
        </p>
      </div>
    );
  }

  const totalCount = localRecs.length + uploaded.length;

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-4 pb-2 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900">🎤 My sounds</h1>
        <p className="text-sm text-slate-600">{totalCount} sound{totalCount !== 1 && "s"}</p>
      </header>

      <main className="flex-1 overflow-y-auto px-3 pb-20 max-w-3xl mx-auto w-full">
        {totalCount === 0 && !loading && (
          <div className="text-center py-12 text-slate-500">
            <div className="text-5xl mb-3">🎙️</div>
            <p className="font-bold text-slate-700">No sounds yet</p>
            <p className="text-sm">Tap 🎤 Make a sound on the Sounds tab to record one.</p>
          </div>
        )}

        {/* Server-uploaded recordings (public, visible on profile) */}
        {uploaded.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-purple-900 mt-3 mb-2">☁️ Public on your profile</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {uploaded.map((r) => (
                <RecordingTile
                  key={r.id}
                  emoji={r.emoji}
                  label={r.name}
                  sublabel={r.durationSec ? `${r.durationSec.toFixed(1)}s` : ""}
                  color="from-fuchsia-200 to-fuchsia-400"
                  onPlay={(e) => onPlay(audioUrl(r.audioUrl.split("/").pop()!), e)}
                  onDelete={async () => {
                    if (!confirm("Delete this public sound?")) return;
                    try { await api.deleteRecording(r.id); } catch {}
                    setUploaded((u) => u.filter((x) => x.id !== r.id));
                    // Also remove from local mirror
                    const next = localRecs.filter((x) => x.uploadedId !== r.id);
                    saveLocal(next);
                    setLocalRecs(next);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Local-only recordings (pending upload or kept private) */}
        {localRecs.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-amber-900 mt-3 mb-2">
              📱 On this device
              {Array.from(uploading).length > 0 && <span className="text-xs text-slate-500 ml-1">(uploading…)</span>}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {localRecs.map((r) => (
                <LocalTile
                  key={r.id}
                  rec={r}
                  uploading={uploading.has(r.id)}
                  onPlay={(e) => onPlay(r.url, e)}
                  onDelete={() => onDelete(r)}
                  onRename={(name) => onRename(r.id, name)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function RecordingTile({
  emoji, label, sublabel, color, onPlay, onDelete,
}: {
  emoji: string; label: string; sublabel: string; color: string;
  onPlay: (e: React.MouseEvent | React.TouchEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`relative aspect-square rounded-3xl bg-gradient-to-br ${color} shadow-xl border-4 border-white active:scale-95 select-none`}>
      <button
        onClick={onPlay}
        style={{ touchAction: "manipulation" }}
        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2"
      >
        <div className="text-5xl sm:text-6xl">{emoji}</div>
        <div className="mt-1 text-sm font-bold text-amber-950 truncate max-w-full">{label}</div>
        {sublabel && <div className="text-xs text-amber-900/70">{sublabel}</div>}
      </button>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
      >
        ✕
      </button>
    </div>
  );
}

function LocalTile({
  rec, uploading, onPlay, onDelete, onRename,
}: {
  rec: LocalRecording;
  uploading: boolean;
  onPlay: (e: React.MouseEvent | React.TouchEvent) => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rec.name || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-amber-200 to-amber-400 shadow-xl border-4 border-white active:scale-95 select-none">
      {editing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 40))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(draft.trim() || `My fart ${rec.id.slice(-4)}`); setEditing(false); }
              if (e.key === "Escape") { setDraft(rec.name || ""); setEditing(false); }
            }}
            className="w-full text-sm px-1 py-0.5 rounded border border-amber-700 bg-white text-amber-950"
            placeholder="Name"
          />
          <button
            onClick={() => { onRename(draft.trim() || `My fart ${rec.id.slice(-4)}`); setEditing(false); }}
            className="mt-1 text-xs bg-amber-700 text-white px-2 py-0.5 rounded active:scale-95"
          >Save</button>
        </div>
      ) : (
        <button
          onClick={onPlay}
          style={{ touchAction: "manipulation" }}
          className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-2"
        >
          <div className="text-5xl sm:text-6xl">{rec.uploaded ? "☁️" : "📱"}</div>
          <div className="mt-1 text-sm font-bold text-amber-950 truncate max-w-full">{rec.name || `My fart ${rec.id.slice(-4)}`}</div>
          <div className="text-xs text-amber-900/70">
            {uploading ? "uploading…" : `${rec.duration.toFixed(1)}s`}
          </div>
        </button>
      )}
      {!editing && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            aria-label="Rename"
            className="absolute top-1 left-1 w-7 h-7 rounded-full bg-amber-700 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
          >✎</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md active:scale-90"
          >✕</button>
        </>
      )}
    </div>
  );
}
