// Shared FX state across the app. Currently only SoundsPage uses it,
// but the architecture is here so other pages (e.g., a "preview" tile)
// can read/write the same FX.

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Flavor } from "./audio/fartEngine";

type FxState = {
  activeFlavors: Set<Flavor>;
  setActiveFlavors: (updater: (cur: Set<Flavor>) => Set<Flavor>) => void;
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
  const [activeFlavors, setActiveFlavorsState] = useState<Set<Flavor>>(new Set());
  const setActiveFlavors = useCallback((updater: (cur: Set<Flavor>) => Set<Flavor>) => {
    setActiveFlavorsState((cur) => updater(cur));
  }, []);
  const [pitch, setPitch] = useState(1.0);
  const [length, setLength] = useState(1.0);
  const [echo, setEcho] = useState(false);
  const resetFx = useCallback(() => {
    setActiveFlavorsState(new Set());
    setPitch(1.0);
    setLength(1.0);
    setEcho(false);
  }, []);

  return (
    <Ctx.Provider value={{ activeFlavors, setActiveFlavors, pitch, setPitch, length, setLength, echo, setEcho, resetFx }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFx(): FxState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFx must be used inside <FxProvider>");
  return v;
}
