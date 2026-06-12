// useToast.ts — extracted from PootBox.tsx in v52
// Owns: a single transient message (auto-clears after 1.5s)

import { useState, useCallback } from "react";

const TOAST_TIMEOUT_MS = 1500;

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_TIMEOUT_MS);
  }, []);

  return { toastMessage, showToast };
}
