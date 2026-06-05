// Shared poof helper. App.tsx owns the poof state and renders the
// floating 💨 divs. Pages call onPoof(x, y, emoji) to spawn one.

import { createContext, useContext, type ReactNode } from "react";

type PoofFn = (x: number, y: number, emoji: string) => void;

const Ctx = createContext<PoofFn | null>(null);

export function PoofProvider({ value, children }: { value: PoofFn; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePoof(): PoofFn {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePoof must be used inside <PoofProvider>");
  return v;
}
