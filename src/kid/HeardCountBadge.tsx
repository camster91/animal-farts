import { useEffect, useRef, useState } from 'react';

interface Props {
  count: number;
}

export function HeardCountBadge({ count }: Props) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setVisible(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisible(false), 5000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [count]);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold"
      style={{
        background: '#fbbf24',
        color: '#1f2937',
        opacity: visible ? 1 : 0.3,
        transition: 'opacity 400ms ease',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span>🏆</span>
      <span>{count}</span>
    </div>
  );
}
