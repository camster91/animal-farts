// PIN gate — setup, enter, or change a 4-digit PIN
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface PinGateHandle {
  triggerShake: (msg: string) => void;
}

interface Props {
  mode: 'enter' | 'setup' | 'change';
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
}

const PinGate = forwardRef<PinGateHandle, Props>(function PinGate({ mode, onSubmit, onCancel }, ref) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    triggerShake(msg: string) {
      setShake(true);
      setDigits(['', '', '', '']);
      setError(msg);
      setTimeout(() => {
        setShake(false);
        inputs.current[0]?.focus();
      }, 600);
    },
  }), []);

  useEffect(() => {
    setDigits(['', '', '', '']);
    setError('');
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }, [mode]);

  function handleChange(idx: number, val: string) {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[idx] = cleaned;
    setDigits(newDigits);
    setError('');
    if (cleaned && idx < 3) {
      inputs.current[idx + 1]?.focus();
    }
    if (newDigits.every((d) => d !== '')) {
      const pin = newDigits.join('');
      onSubmit(pin);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  }

  const title = mode === 'setup' ? 'Set up your PIN' : mode === 'change' ? 'Change your PIN' : 'Enter PIN';
  const subtitle =
    mode === 'setup'
      ? 'Choose a 4-digit PIN to protect the parent dashboard'
      : mode === 'change'
      ? 'Enter a new 4-digit PIN'
      : 'Enter your 4-digit PIN to continue';

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 px-4">
      <div className={`w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-8px); }
            80% { transform: translateX(8px); }
          }
          .animate-shake { animation: shake 0.6s ease-in-out; }
        `}</style>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-2xl font-bold text-amber-900">{title}</h1>
          <p className="text-amber-700 mt-2 text-sm">{subtitle}</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-14 h-16 text-center text-2xl font-bold border-2 border-amber-300 rounded-xl bg-white shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm font-medium text-center">{error}</p>
          )}

          {mode !== 'enter' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 text-amber-700 hover:text-amber-900 text-sm underline"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default PinGate;
