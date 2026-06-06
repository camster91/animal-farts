// Card 8: Import code — enter a 4-char share code to see a kid's metadata
import { useState } from 'react';
import { getKidStorage } from '../kid/useKidStorage';
import type { Profile } from '../kid/useKidStorage';

interface Props {
  activeProfileId: string;
}

interface LookupResult {
  profile: Profile;
  sceneName: string;
  emoji: string;
}

export default function ImportCodeCard({ activeProfileId: _activeProfileId }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const storage = getKidStorage();
      const found = await storage.findProfileByShareCode(code.trim());
      if (found) {
        setResult(found);
      } else {
        setError("Code not found — make sure you entered it correctly!");
      }
    } catch {
      setError("Something went wrong. Try again?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔍</span>
        <div>
          <h2 className="font-bold text-amber-900">Look up a code</h2>
          <p className="text-xs text-amber-600">Have a code? Enter it to see a kid&apos;s pins</p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder="CODE"
          maxLength={4}
          className="flex-1 bg-amber-100 border-2 border-amber-300 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-amber-900 tracking-widest uppercase placeholder:text-amber-400 placeholder:normal-case focus:outline-none focus:border-amber-500"
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
        />
        <button
          onClick={handleLookup}
          disabled={loading || code.length < 4}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center"
        >
          {loading ? '⏳' : 'Look up'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: '2rem' }}>{result.emoji}</span>
            <div>
              <div className="font-bold text-amber-900">{result.profile.name}</div>
              <div className="text-xs text-amber-600">Last seen in {result.sceneName}</div>
            </div>
          </div>
          <div className="text-xs text-amber-500">
            Pin made with {result.profile.avatar} · {new Date(result.profile.createdAt).toLocaleDateString()}
          </div>
          <div className="mt-2 text-xs text-amber-500 italic">
            🎵 Sounds shared with love — no playback needed
          </div>
        </div>
      )}

      <p className="text-xs text-amber-500 mt-3">
        Enter a 4-character code to see a kid&apos;s name, scene, and emoji. No sounds are played.
      </p>
    </div>
  );
}
