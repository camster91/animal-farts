// ToastProvider — app-wide accessible toast notifications.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ToastContext, VARIANT_STYLE, type ToastPayload, type ToastVariant } from "./toastShared";

interface ToastState extends Required<Pick<ToastPayload, "message" | "variant">> {
  id: number;
  durationMs: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showToast = useCallback((message: string, opts?: Omit<ToastPayload, "message">) => {
    clearTimer();
    const id = ++idRef.current;
    const variant: ToastVariant = opts?.variant ?? "info";
    const durationMs = opts?.durationMs ?? (variant === "error" ? 3200 : 2000);
    setToast({ id, message, variant, durationMs });
    timerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
      timerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live={toast.variant === "error" ? "assertive" : "polite"}
          aria-atomic="true"
          className="pb-toast"
          style={{
            position: "fixed",
            top: "max(16px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1200,
            maxWidth: "min(420px, calc(100vw - 32px))",
            padding: "12px 18px",
            borderRadius: 16,
            border: `2px solid ${VARIANT_STYLE[toast.variant].border}`,
            background: VARIANT_STYLE[toast.variant].bg,
            color: VARIANT_STYLE[toast.variant].fg,
            fontFamily: "Fredoka, system-ui, sans-serif",
            fontSize: "0.95rem",
            fontWeight: 600,
            boxShadow: "0 8px 28px rgba(61, 44, 30, 0.18)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
