// Poot Party — Welcome screen. Shown once per device after profile selection.
// Big 💨 mascot with friendly face, one instruction line, auto-dismiss 4s or tap to dismiss.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'poot-party-welcome-seen';
const AUTO_DISMISS_MS = 4000;

interface Props {
  onDismiss: () => void;
}

export function WelcomeScreen({ onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const auto = window.setTimeout(() => {
      handleDismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(auto);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch { /* ignore */ }
    // Notify parent to unmount
    onDismiss();
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#F5C842', // gold
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Big 💨 with CSS eyes */}
      <div style={{ position: 'relative', fontSize: 'clamp(100px, 25vw, 160px)', lineHeight: 1 }}>
        💨
        {/* Eyes */}
        <div style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, 0)',
          display: 'flex',
          gap: '0.5em',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '0.35em',
            height: '0.35em',
            borderRadius: '50%',
            background: '#3D2C1E',
          }} />
          <div style={{
            width: '0.35em',
            height: '0.35em',
            borderRadius: '50%',
            background: '#3D2C1E',
          }} />
        </div>
      </div>

      {/* Instruction line */}
      <p style={{
        fontFamily: 'Fredoka, system-ui, sans-serif',
        fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
        fontWeight: 600,
        color: '#FEF9E7', // cream
        textShadow: '0 2px 8px rgba(61,44,30,0.35)',
        textAlign: 'center',
        padding: '0 32px',
        maxWidth: 360,
      }}>
        Tap things to make sounds! Tap and hold to make your own.
      </p>
    </div>
  );
}
