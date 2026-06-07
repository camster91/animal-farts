// v30: "Report a problem" modal — mirrors /api/errors fetch pattern
import { useState } from 'react';

interface Props {
  profileId?: string;
  onClose: () => void;
}

// DEV check — mirrors UploadSoundCard pattern
const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === '1';

export default function FeedbackModal({ profileId, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [skipValidation, setSkipValidation] = useState(false);

  async function handleSend() {
    if (!skipValidation && !message.trim()) return;
    setSending(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim() || '(dev mode — empty message)',
          profileId: profileId ?? '',
          url: window.location.href,
          userAgent: navigator.userAgent,
          ts: Date.now(),
        }),
      });
      setDone(true);
    } catch {
      // silently fail — don't block the user
      setDone(true);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: '1.5rem', padding: '1.75rem',
          maxWidth: '22rem', width: '90vw', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          fontFamily: 'Fredoka, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <>
            <div className="text-center mb-4">
              <span className="text-4xl block mb-2">🙏</span>
              <h2 className="text-xl font-bold text-amber-900">Thanks! We'll look into it.</h2>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">🔧</span>
              <h2 className="text-xl font-bold text-amber-900">Something not working? Tell us!</h2>
            </div>
            <p className="text-amber-700 text-sm mb-4">
              Describe what happened and we'll fix it.
            </p>

            {/* Textarea */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="It crashed when I tapped the cow…"
              rows={4}
              className="w-full rounded-xl border-2 border-amber-200 px-3 py-2 text-amber-900 placeholder-amber-300 resize-none focus:outline-none focus:border-amber-400"
              autoFocus
            />

            {/* DEV skip validation */}
            {isDev && (
              <label className="flex items-center gap-2 mt-2 mb-3 text-xs text-amber-600">
                <input
                  type="checkbox"
                  checked={skipValidation}
                  onChange={e => setSkipValidation(e.target.checked)}
                />
                DEV: skip validation
              </label>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={onClose}
                className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || (!skipValidation && !message.trim())}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:text-amber-400 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}