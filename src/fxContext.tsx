// Shared FX state across the app. The SoundsPage reads/writes pitch,
// length, echo, and a reset action via this context.

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type FxState = {
  pitch: number;
  setPitch: (v: number) => void;
  length: number;
  setLength: (v: number) => void;
  echo: boolean;
  setEcho: (v: boolean) => void;
  resetFx: () => void;
};

const Ctx = createContext<FxState | null>(null);

export function FxProvider({ children }: { children: ReactNode }) {
  const [pitch, setPitch] = useState(1.0);
  const [length, setLength] = useState(1.0);
  const [echo, setEcho] = useState(false);
  const resetFx = useCallback(() => {
    setPitch(1.0);
    setLength(1.0);
    setEcho(false);
  }, []);

  return (
    <Ctx.Provider value={{ pitch, setPitch, length, setLength, echo, setEcho, resetFx }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFx(): FxState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFx must be used inside <FxProvider>");
  return v;
}
