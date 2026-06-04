// PinGate — modal that prompts for a numeric PIN and only renders its
// children when the PIN matches. Used to wrap the "Adult mode" toggle
// in the parental tab.
//
// On a fresh install the default PIN is "1234" — the parent is told
// this in the parental UI and can change it.

import { useState, useEffect, useRef, useCallback } from "react";
import { checkParentPin, setParentPin } from "./adultMode";

export function PinGate({
  open,
  onClose,
  title = "Parent PIN",
  onSuccess,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  onSuccess?: () => void;
  children: (unlock: () => void) => React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"enter" | "set">("enter");
  const [draft, setDraft] = useState("");
  const [confirmDraft, setConfirmDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setMode("enter");
      setDraft("");
      setConfirmDraft("");
      setUnlocked(false);
      // small delay so the input has rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = useCallback(() => {
    if (mode === "enter") {
      if (checkParentPin(pin)) {
        setUnlocked(true);
        onSuccess?.();
      } else {
        setError("Wrong PIN. Try again.");
        setPin("");
        inputRef.current?.focus();
      }
    } else {
      // set
      if (draft.length < 4) {
        setError("PIN must be at least 4 digits.");
        return;
      }
      if (draft !== confirmDraft) {
        setError("PINs don't match.");
        return;
      }
      setParentPin(draft);
      setUnlocked(true);
      setMode("enter");
      onSuccess?.();
    }
  }, [mode, pin, draft, confirmDraft, onSuccess]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
        {!unlocked ? (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">🔒 {title}</h2>
            <p className="text-sm text-slate-600 mb-4">
              {mode === "enter"
                ? `Default is 1234 (you can change it inside).`
                : "Pick a new PIN. At least 4 digits."}
            </p>
            {mode === "enter" ? (
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="••••"
                className="w-full px-4 py-4 rounded-xl border-2 border-slate-300 text-center font-mono text-2xl tracking-widest mb-3"
              />
            ) : (
              <div className="space-y-2 mb-3">
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
                  placeholder="New PIN"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 text-center font-mono text-xl tracking-widest"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirmDraft}
                  onChange={(e) => { setConfirmDraft(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(null); }}
                  placeholder="Confirm"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 text-center font-mono text-xl tracking-widest"
                />
              </div>
            )}
            {error && <div className="bg-red-100 border-2 border-red-300 text-red-800 rounded-xl p-2 mb-3 text-sm">{error}</div>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-800 font-bold">Cancel</button>
              {mode === "enter" ? (
                <button onClick={submit} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95">Unlock</button>
              ) : (
                <button onClick={submit} className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold active:scale-95">Save PIN</button>
              )}
            </div>
            {mode === "enter" && (
              <button
                onClick={() => { setMode("set"); setError(null); }}
                className="w-full mt-3 text-xs text-slate-500 hover:underline"
              >
                Change PIN
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-slate-800">{title.replace("Parent PIN", "Adult settings")}</h2>
              <button
                onClick={() => { setUnlocked(false); onClose(); }}
                className="text-xs text-slate-500 hover:underline"
              >
                🔒 Re-lock
              </button>
            </div>
            {children(() => { setUnlocked(false); onClose(); })}
          </>
        )}
      </div>
    </div>
  );
}
