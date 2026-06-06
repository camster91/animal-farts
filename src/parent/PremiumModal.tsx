// Upgrade modal — shows pricing tiers and (in dev) a simulate-premium toggle
import { useState } from 'react';

type Tier = 'monthly' | 'yearly';

interface Props {
  onClose: () => void;
  onSimulatePremium: () => void;
}

export default function PremiumModal({ onClose, onSimulatePremium }: Props) {
  const [selectedTier, setSelectedTier] = useState<Tier>('yearly');

  function handleContinue() {
    // In production this would call the real Stripe Checkout endpoint.
    // For now, flip premium via the store since we don't have Stripe keys.
    onSimulatePremium();
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '1.5rem', padding: '1.75rem',
          maxWidth: '22rem', width: '90vw', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          fontFamily: 'Fredoka, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-3xl">💎</span>
          <h2 className="text-xl font-bold text-amber-900">Poot Party Premium</h2>
        </div>
        <p className="text-amber-700 text-sm mb-5">
          Unlock everything — custom sounds, pitch shift, and unlimited recordings.
        </p>

        {/* Pricing tiers */}
        <div className="space-y-2 mb-5">
          {/* Monthly */}
          <button
            onClick={() => setSelectedTier('monthly')}
            className={`w-full text-left rounded-xl px-4 py-3 border-2 transition-all ${
              selectedTier === 'monthly'
                ? 'border-amber-500 bg-amber-50'
                : 'border-amber-200 bg-white hover:border-amber-300'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-900">Monthly</span>
              <span className="font-bold text-amber-700">$1.99<span className="text-xs font-normal text-amber-500">/mo</span></span>
            </div>
            {selectedTier === 'monthly' && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-xs text-amber-600">Billed monthly, cancel anytime</span>
              </div>
            )}
          </button>

          {/* Yearly */}
          <button
            onClick={() => setSelectedTier('yearly')}
            className={`w-full text-left rounded-xl px-4 py-3 border-2 transition-all ${
              selectedTier === 'yearly'
                ? 'border-amber-500 bg-amber-50'
                : 'border-amber-200 bg-white hover:border-amber-300'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900">Yearly</span>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Save 37%</span>
              </div>
              <span className="font-bold text-amber-700">$14.99<span className="text-xs font-normal text-amber-500">/yr</span></span>
            </div>
            {selectedTier === 'yearly' && (
              <div className="flex items-center gap-1 mt-1">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-xs text-amber-600">$1.25/mo — best value!</span>
              </div>
            )}
          </button>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors mb-3"
        >
          Continue with {selectedTier === 'monthly' ? '$1.99/mo' : '$14.99/yr'}
        </button>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full text-amber-600 hover:text-amber-800 text-sm font-medium py-1 transition-colors mb-4"
        >
          Cancel
        </button>

        {/* DEV: simulate premium toggle */}
        {import.meta.env.DEV && (
          <div className="border-t border-amber-100 pt-4 mt-2">
            <p className="text-xs text-amber-500 font-bold mb-2 uppercase tracking-wide">Dev only</p>
            <button
              onClick={() => { onSimulatePremium(); onClose(); }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl transition-colors text-sm"
            >
              🧪 DEV: Simulate premium
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
