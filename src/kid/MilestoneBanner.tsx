// MilestoneBanner — shows "🎉 N POOTS! 🎉" for 1.5s then fades out.

import { useEffect, useState } from 'react';

interface MilestoneBannerProps {
  count: number;
  onComplete?: () => void;
}

export function MilestoneBanner({ count, onComplete }: MilestoneBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1500);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (!visible) return null;

  return (
    <div
      className="milestone-banner-enter"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99998,
        pointerEvents: 'none',
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        display: 'inline-block',
        background: 'rgba(0,0,0,0.65)',
        color: '#fff',
        borderRadius: '1rem',
        padding: '0.6rem 1.4rem',
        fontSize: 'clamp(1.2rem, 5vw, 2rem)',
        fontWeight: 700,
        fontFamily: 'Fredoka, system-ui, sans-serif',
        letterSpacing: '0.02em',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}>
        🎉 {count} POOTS! 🎉
      </span>
    </div>
  );
}
