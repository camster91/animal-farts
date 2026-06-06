// Card: Premium tier status and upgrade CTA
import { useState } from 'react';
import PremiumModal from './PremiumModal';

interface Props {
  isPremium: boolean;
  onSimulatePremium: () => void;
}

export default function PremiumCard({ isPremium, onSimulatePremium }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">💎</span>
          <div>
            <h2 className="font-bold text-amber-900">Poot Party Premium</h2>
            <p className="text-xs text-amber-600">Unlock all features</p>
          </div>
        </div>

        {isPremium ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-green-800 font-bold text-sm">Premium unlocked</span>
          </div>
        ) : (
          <>
            <ul className="text-sm text-amber-700 space-y-1.5 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-amber-500">✨</span>
                <span>Custom sound upload</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-500">🎛️</span>
                <span>Voice pitch shift</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-amber-500">🎙️</span>
                <span>Unlimited recordings</span>
              </li>
            </ul>
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors"
            >
              Upgrade — from $1.99/mo
            </button>
          </>
        )}
      </div>

      {showModal && (
        <PremiumModal
          onClose={() => setShowModal(false)}
          onSimulatePremium={onSimulatePremium}
        />
      )}
    </>
  );
}
