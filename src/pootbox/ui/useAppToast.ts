// useAppToast.ts — hook companion for ToastProvider (split for react-refresh).

import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "./toastShared";

export type { ToastPayload, ToastVariant } from "./toastShared";

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { showToast: (() => {}) as ToastContextValue["showToast"] };
  }
  return ctx;
}
