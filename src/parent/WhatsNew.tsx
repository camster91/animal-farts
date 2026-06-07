// v30: "What's new" toast — shown once when the app version changes.
// Uses localStorage to track which version was last shown.
// Does NOT show on first-ever visit (new users don't need onboarding notes).
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'poot-party-version-seen';

interface Props {
  version: string;
  onDismiss: () => void;
}

const WHATS_NEW: Record<string, string[]> = {
  '1.0.0': [
    '7 scenes to explore (Farm, Jungle, Ocean, City, Bedroom, Bathroom, Home)',
    'Record your own sounds by long-pressing',
    'Drop pins anywhere you want',
    '5 operator settings for grown-ups',
  ],
};

export default function WhatsNew({ version, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen === null) {
        // First ever visit — don't show what's new
        localStorage.setItem(STORAGE_KEY, version);
        return;
      }
      if (seen !== version) {
        setVisible(true);
        localStorage.setItem(STORAGE_KEY, version);
      }
    } catch {
      // localStorage unavailable — skip
    }
  }, [version]);

  if (!visible) return null;

  const bullets = WHATS_NEW[version] ?? [];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'max(88px, env(safe-area-inset-bottom, 88px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99998,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: '1rem',
        padding: '0.9rem 1.2rem 0.9rem 1.2rem',
        maxWidth: '20rem',
        width: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        fontFamily: 'Fredoka, system-ui, sans-serif',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-amber-900">What's new in v{version}</h3>
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          className="text-amber-400 hover:text-amber-600 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <ul className="space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-amber-700 flex items-start gap-1.5">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}