// useToast.ts — thin wrapper over app-wide ToastProvider.

import { useAppToast } from "../ui/useAppToast";
import type { ToastPayload } from "../ui/toastShared";

export function useToast() {
  const { showToast: show } = useAppToast();

  return {
    /** @deprecated Toast UI is rendered by ToastProvider — always null. */
    toastMessage: null as string | null,
    showToast: (msg: string, opts?: Omit<ToastPayload, "message">) => {
      show(msg, opts);
    },
  };
}
