// useSettings.ts — extracted from PootBox.tsx in v52
// Owns: volume, reduced motion, localStorage persistence

import { useState, useEffect, useRef } from "react";
import { loadSettings, saveSettings } from "../constants";
import type { Settings } from "../types";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const update = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  return {
    settings,
    settingsRef,
    setSettings: update,
    setVolume: (volume: number) => update({ ...settings, volume }),
    setReducedMotion: (reducedMotion: boolean) =>
      update({ ...settings, reducedMotion }),
  };
}
