// useModalState.ts — extracted from PootBox.tsx in v52
// Owns: which modal/sheet is open (library, settings, share, volume, add-sound, first-run)

import { useState, useCallback } from "react";

export type ShareMode = "none" | "share" | "lookup";

export function useModalState() {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showShare, setShowShare] = useState<ShareMode>("none");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(
    () => !localStorage.getItem("pootbox-firstrun-done"),
  );

  const closeAll = useCallback(() => {
    setShowLibrary(false);
    setShowSettings(false);
    setShowVolume(false);
    setShowShare("none");
    setShowAddMenu(false);
  }, []);

  return {
    showLibrary,
    showSettings,
    showVolume,
    showShare,
    showAddMenu,
    showFirstRun,
    setShowLibrary,
    setShowSettings,
    setShowVolume,
    setShowShare,
    setShowAddMenu,
    setShowFirstRun,
    closeAll,
  };
}
