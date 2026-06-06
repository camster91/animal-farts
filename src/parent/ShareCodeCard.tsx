// Card 5: Share codes
import { useState } from 'react';

interface Props {
  shareCode: string;
  onRegenerate: () => void;
  onCopy: () => Promise<void>;
}

export default function ShareCodeCard({ shareCode, onRegenerate, onCopy }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔗</span>
        <div>
          <h2 className="font-bold text-amber-900">Share code</h2>
          <p className="text-xs text-amber-600">Share this app with other parents</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 bg-amber-100 border-2 border-amber-300 rounded-xl px-4 py-3 text-center">
          <span className="text-2xl font-mono font-bold text-amber-900 tracking-widest">
            {shareCode || '----'}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {copied ? '✅ Copied!' : '📋 Copy code'}
        </button>
        <button
          onClick={onRegenerate}
          className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          🔄 New code
        </button>
      </div>

      <p className="text-xs text-amber-500 mt-3">
        Other parents can enter this code at{' '}
        <span className="font-mono bg-amber-100 px-1 rounded">/parent?import={'<code>'}</span>{' '}
        to see this profile's recordings (v27)
      </p>
    </div>
  );
}
