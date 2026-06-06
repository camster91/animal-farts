// A small "👆 Tap to play" hint that appears on first scene load, then fades
// after 4 seconds OR the first tap, whichever comes first. Uses localStorage
// so it only shows once per device (kids don't need a re-introduction).

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'poot-party-tap-hint-seen';
const HINT_DURATION_MS = 4000;

export function FirstTapHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // localStorage may be unavailable; just show the hint.
    }
    // Small delay so the scene entrance animation finishes first
    const t = window.setTimeout(() => setVisible(true), 1200);
    const fade = window.setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    }, 1200 + HINT_DURATION_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(fade);
    };
  }, []);

  // Also dismiss on first tap anywhere
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      setVisible(false);
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('touchstart', dismiss);
    };
    window.addEventListener('pointerdown', dismiss, { once: true, passive: true });
    window.addEventListener('touchstart', dismiss, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('touchstart', dismiss);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.55)',
        color: 'white',
        padding: '14px 24px',
        borderRadius: 999,
        fontSize: '1.5rem',
        fontWeight: 700,
        zIndex: 100,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.3)',
        animation: 'hint-bounce 800ms ease-in-out infinite alternate',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ fontSize: '1.6em' }}>👆</span>
      <span>Tap!</span>
    </div>
  );
}
