// Card: custom sound upload — parent picks a thing and drops in an MP3
import { useState, useRef, useCallback } from 'react';
import { SCENES } from '../kid/scenes';
import { getKidStorage } from '../kid/useKidStorage';
import type { UploadedSound } from '../kid/useKidStorage';
import { useParentStore } from './store';
import PremiumModal from './PremiumModal';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

interface Props {
  activeProfileId: string;
}

export default function UploadSoundCard({ activeProfileId }: Props) {
  const { settings, setPremium } = useParentStore();
  const isPremium = settings.isPremium;
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [sceneId, setSceneId] = useState<string>(SCENES[1].id); // skip home
  const [thingId, setThingId] = useState<string>('');
  const [uploaded, setUploaded] = useState<UploadedSound | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const storage = getKidStorage();

  // DEV simulate button — works via ?dev=1 in production too
  const showSimulate =
    import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';

  const scene = SCENES.find(s => s.id === sceneId) ?? SCENES[1];
  const things = scene.things;

  // Load the current uploaded sound for the selected thing
  const loadUploaded = useCallback(async (sid: string, tid: string, pid: string) => {
    if (!tid) { setUploaded(null); return; }
    const s = await storage.getUploadedSound(sid, tid, pid);
    setUploaded(s);
  }, [storage]);

  const handleSceneChange = (nextSceneId: string) => {
    setSceneId(nextSceneId);
    setThingId('');
    setUploaded(null);
    setError('');
 void loadUploaded(nextSceneId, '', activeProfileId);
  };

  const handleThingChange = (tid: string) => {
    setThingId(tid);
    setError('');
    void loadUploaded(sceneId, tid, activeProfileId);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError('File too big — max 5MB please!');
      return;
    }

    if (!file.type.startsWith('audio/')) {
      setError('Not an audio file — please pick an MP3, M4A, or WAV.');
      return;
    }

    setLoading(true);
    try {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const sound: UploadedSound = {
        id,
        sceneId,
        thingId,
        profileId: activeProfileId,
        blob: file,
        mimeType: file.type,
        createdAt: Date.now(),
      };
      await storage.saveUploadedSound(sound);
      setUploaded(sound);
    } catch (err) {
      setError('Something went wrong saving the sound. Try again?');
    } finally {
      setLoading(false);
    }

    // Reset the input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async () => {
    if (!uploaded) return;
    await storage.deleteUploadedSound(uploaded.id);
    setUploaded(null);
  };

  const selectedThing = things.find(t => t.id === thingId);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎤</span>
        <div>
          <h2 className="font-bold text-amber-900">Upload sound</h2>
          <p className="text-xs text-amber-600">Replace a thing's sound with your own</p>
        </div>
      </div>

      {/* Premium gate — non-premium users see locked card */}
      {!isPremium ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🔒</div>
          <p className="text-amber-800 font-bold mb-1">Premium feature</p>
          <p className="text-amber-600 text-sm mb-4">Upload your own sounds for any thing</p>
          <button
            onClick={() => setShowPremiumModal(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2 px-6 rounded-xl transition-colors text-sm"
          >
            Upgrade to unlock
          </button>
        </div>
      ) : (
        <>
          {/* DEV simulate button */}
          {showSimulate && (
            <button
              onClick={() => setPremium(false)}
              className="w-full mb-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-1.5 rounded-xl transition-colors text-xs"
            >
              🧪 DEV: Simulate non-premium
            </button>
          )}

          {/* Scene picker */}
          <label className="block mb-3">
            <span className="text-sm font-medium text-amber-800 mb-1 block">Scene</span>
            <select
              value={sceneId}
              onChange={e => handleSceneChange(e.target.value)}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {SCENES.filter(s => s.id !== 'home').map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {/* Thing picker */}
          <label className="block mb-3">
            <span className="text-sm font-medium text-amber-800 mb-1 block">Thing</span>
            <select
              value={thingId}
              onChange={e => handleThingChange(e.target.value)}
              className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Pick a thing…</option>
              {things.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
          </label>

          {/* Current status */}
          {thingId && (
            <div className="mb-3 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              {uploaded
                ? <span className="text-green-700">✓ Custom sound set for {selectedThing?.emoji} {selectedThing?.name}</span>
                : <span>Using default sound for {selectedThing?.emoji} {selectedThing?.name}</span>
              }
            </div>
          )}

          {/* File input — MP3, M4A, WAV, OGG accepted */}
          {thingId && (
            <div className="mb-3">
              <input
                ref={inputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/m4a,audio/wav,audio/ogg"
                onChange={handleFileChange}
                disabled={loading}
                className="block w-full text-sm text-amber-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-500 file:text-white hover:file:bg-amber-600 disabled:opacity-50"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</div>
          )}

          {/* Remove button */}
          {uploaded && (
            <button
              onClick={handleRemove}
              className="w-full bg-white border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold py-2 rounded-xl transition-colors text-sm"
            >
              🗑️ Remove custom sound
            </button>
          )}
        </>
      )}

      {showPremiumModal && (
        <PremiumModal
          onClose={() => setShowPremiumModal(false)}
          onSimulatePremium={() => setPremium(true)}
        />
      )}
    </div>
  );
}
