// Shared toast types + context object (no components — safe for react-refresh).

import { createContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastPayload {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastContextValue {
  showToast: (message: string, opts?: Omit<ToastPayload, "message">) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const VARIANT_STYLE: Record<ToastVariant, { bg: string; fg: string; border: string }> = {
  success: { bg: "#FFF8E7", fg: "#3D2C1E", border: "#F59E0B" },
  error: { bg: "#FFF1F0", fg: "#7A2E2A", border: "#E07A5F" },
  info: { bg: "#3D2C1E", fg: "#FFF8E7", border: "#3D2C1E" },
};
