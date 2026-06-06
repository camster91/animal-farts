import { useEffect, useRef, useState } from 'react';

interface Props {
  count: number;
}

export function HeardCountBadge({ count }: Props) {
  // Pulse the badge on every count change. Never fade — the count is a
  // kid-facing status ("you've heard 7 sounds!") and should always be visible.
  const [pulseKey, setPulseKey] = useState(0);
  const lastCountRef = useRef(count);

  useEffect(() => {
    if (count !== lastCountRef.current) {
      lastCountRef.current = count;
      setPulseKey(k => k + 1);
    }
  }, [count]);

  return (
    <div
      className="fixed z-50 flex items-center gap-2 px-4 py-2.5 rounded-full font-extrabold"
      style={{
        bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        right: 'max(20px, env(safe-area-inset-right, 20px))',
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        color: '#1f2937',
        fontSize: '1.5rem',
        boxShadow: '0 6px 16px rgba(245, 158, 11, 0.5), 0 0 0 4px rgba(255, 255, 255, 0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '0.02em',
        minWidth: '5rem',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: '1.5em', lineHeight: 1 }}>🏆</span>
      <span
        key={pulseKey}
        style={{
          display: 'inline-block',
          minWidth: '1.2em',
          textAlign: 'center',
          animation: pulseKey > 0 ? 'count-bump 480ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        }}
      >
        {count}
      </span>
    </div>
  );
}
