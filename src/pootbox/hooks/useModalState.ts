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
    () => {
      // v80: check both keys so the dismiss-time write to
      // pootbox-onboarded-v2 is honored. The FirstRunIntro's
      // onDone writes BOTH keys to be safe.
      try {
        return !(localStorage.getItem("pootbox-firstrun-done") ||
                  localStorage.getItem("pootbox-onboarded-v2"));
      } catch { return true; }
    },
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
