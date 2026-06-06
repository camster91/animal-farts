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
      className="fixed z-50 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-base font-extrabold"
      style={{
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        right: 'max(16px, env(safe-area-inset-right, 16px))',
        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        color: '#1f2937',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4), 0 0 0 3px rgba(255, 255, 255, 0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ fontSize: '1.4em', lineHeight: 1 }}>🏆</span>
      <span
        key={pulseKey}
        style={{
          display: 'inline-block',
          minWidth: '1.5em',
          textAlign: 'center',
          animation: pulseKey > 0 ? 'count-bump 480ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
        }}
      >
        {count}
      </span>
    </div>
  );
}
