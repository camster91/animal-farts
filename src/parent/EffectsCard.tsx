// Card: Voice effects — pitch, speed, reverb + preview
import { useState } from 'react';
import type { ParentSettings } from './types';
import { getAudioEngine } from '../audio/engine';
import { useParentStore } from './store';
import PremiumModal from './PremiumModal';

interface Props {
  effects: ParentSettings['effects'];
  onChange: (fx: ParentSettings['effects']) => void;
}

export default function EffectsCard({ effects, onChange }: Props) {
  const { settings, setPremium } = useParentStore();
  const isPremium = settings.isPremium;
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  async function handlePreview() {
    setPreviewing(true);
    try {
      const engine = getAudioEngine();
      // Convert semitones to playback rate: 2^(semitones/12)
      const rate = Math.pow(2, effects.pitch / 12);
      engine.setPitch(rate);
      engine.setSpeed(effects.speed);
      engine.setReverb(effects.reverb);
      await engine.play('/sounds/cow.mp3');
    } catch (err) {
      console.warn('[effects] preview failed:', err);
    } finally {
      setTimeout(() => setPreviewing(false), 2000);
    }
  }

  return (
    <>
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎛️</span>
        <div>
          <h2 className="font-bold text-amber-900">Voice effects</h2>
          <p className="text-xs text-amber-600">Pitch, speed, and reverb</p>
        </div>
      </div>

      {/* Pitch — premium only */}
      {!isPremium ? (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500">🔒</span>
              <span className="text-sm font-medium text-amber-800">Pitch</span>
            </div>
            <button
              onClick={() => setShowPremiumModal(true)}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold px-2.5 py-1 rounded-full transition-colors"
            >
              Upgrade to unlock
            </button>
          </div>
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={0}
            disabled
            className="w-full accent-amber-300 opacity-50 cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-amber-400 mt-0.5">
            <span>-6 (deep)</span>
            <span>0</span>
            <span>+6 (high)</span>
          </div>
        </div>
      ) : (
        <label className="block mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-amber-800">Pitch</span>
            <span className="text-sm text-amber-600 font-mono">
              {effects.pitch > 0 ? `+${effects.pitch}` : effects.pitch} st
            </span>
          </div>
          <input
            type="range"
            min={-6}
            max={6}
            step={1}
            value={effects.pitch}
            onChange={(e) => onChange({ ...effects, pitch: parseInt(e.target.value, 10) })}
            className="w-full accent-amber-600"
          />
          <div className="flex justify-between text-xs text-amber-400 mt-0.5">
            <span>-6 (deep)</span>
            <span>0</span>
            <span>+6 (high)</span>
          </div>
        </label>
      )}

      {/* Speed */}
      <label className="block mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-amber-800">Speed</span>
          <span className="text-sm text-amber-600 font-mono">{effects.speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.1}
          value={effects.speed}
          onChange={(e) => onChange({ ...effects, speed: parseFloat(e.target.value) })}
          className="w-full accent-amber-600"
        />
        <div className="flex justify-between text-xs text-amber-400 mt-0.5">
          <span>0.5x (slow)</span>
          <span>2.0x (fast)</span>
        </div>
      </label>

      {/* Reverb */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-amber-800">Reverb</span>
        <button
          onClick={() => onChange({ ...effects, reverb: !effects.reverb })}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            effects.reverb ? 'bg-amber-500' : 'bg-amber-200'
          }`}
          aria-label={effects.reverb ? 'Disable reverb' : 'Enable reverb'}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              effects.reverb ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <button
        onClick={handlePreview}
        disabled={previewing}
        className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {previewing ? '🔊 Playing...' : '▶️ Preview (cow)'}
      </button>
    </div>

    {showPremiumModal && (
      <PremiumModal
        onClose={() => setShowPremiumModal(false)}
        onSimulatePremium={() => setPremium(true)}
      />
    )}
    </>
  );
}
