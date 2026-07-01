// App entry. v31 — single-route PootBox app.
// The /parent route has been removed (settings are a backdoor modal now).
// All kid interaction lives at the root URL.
//
// v79: view-switching. Three top-level views — "play" (the
// existing PootBox), "feed" (Friends), "profile" (own profile).
// State lives in this file; the view selection is persisted
// to localStorage so the kid lands where they left off.
//
// v79+: a "public profile" sub-state inside profile. When
// profileHandle is non-null, the profile view renders the
// OTHER user's profile (PublicProfile). When null, it renders
// the kid's own profile (Profile). Triggered by tapping an
// author header in the Feed.
//
// v80: rebuilt the v79 tab bar after the v80 WebMediaPlayer fix
// isolated the click-block to the raf physics tick (NOT the tab
// bar). Playwright E2E (tests/e2e-tabbar.test.mjs) verifies the
// modal dismisses correctly with the tab bar in place. The bug
// was always the physics tick creating 1000+ Audio instances.
// Now that the tick is dead, the tab bar is safe to re-introduce
// — kid product is whole (Play / Friends / Me views).
//

import { useState, useEffect } from "react";
import PootBox from "./pootbox/PootBox";
import Feed from "./pootbox/components/Feed";
import Profile from "./pootbox/components/Profile";
import PublicProfile from "./pootbox/components/PublicProfile";

type View = "play" | "feed" | "profile";

const VIEW_KEY = "pootbox-current-view-v1";
const PROFILE_HANDLE_KEY = "pootbox-profile-handle-v1";

export default function App() {
  const [view, setView] = useState<View>(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === "play" || stored === "feed" || stored === "profile") return stored;
    } catch { /* ignore */ }
    return "play";
  });
  // When view === "profile" and this is set, render PublicProfile.
  // When view === "profile" and this is null, render own Profile.
  const [profileHandle, setProfileHandle] = useState<string | null>(() => {
    try { return localStorage.getItem(PROFILE_HANDLE_KEY); } catch { return null; }
  });

  // Persist view on change so the kid lands where they left off.
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);
  useEffect(() => {
    try {
      if (profileHandle) localStorage.setItem(PROFILE_HANDLE_KEY, profileHandle);
      else localStorage.removeItem(PROFILE_HANDLE_KEY);
    } catch { /* ignore */ }
  }, [profileHandle]);

  function openPublicProfile(handle: string) {
    setProfileHandle(handle);
    setView("profile");
  }
  function backToOwnProfile() {
    setProfileHandle(null);
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {view === "play" && (
        <PootBox />
      )}
      {view === "feed" && (
        <Feed
          onBack={() => setView("play")}
          onOpenProfile={(handle) => openPublicProfile(handle)}
        />
      )}
      {view === "profile" && (
        profileHandle
          ? <PublicProfile handle={profileHandle} onBack={backToOwnProfile} onOpenFeed={() => setView("feed")} />
          : <Profile onBack={() => setView("play")} />
      )}

      {/* v79/v80: bottom tab bar. Fixed to the bottom of the viewport
          with safe-area-inset padding for iOS notches. The
          tab bar is hidden when a modal/sheet is open? — for
          simplicity we always show it; the kid can dismiss
          any modal and click the tab. Z-index sits below
          the modal overlay (which is 400 in CommentsSheet
          / ShareSheet / etc.). */}
      <nav
        role="navigation"
        aria-label="App sections"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
          zIndex: 100,
          fontFamily: "Fredoka, system-ui, sans-serif",
        }}
      >
        <TabButton
          label="Play"
          icon="🎵"
          active={view === "play"}
          onClick={() => { setProfileHandle(null); setView("play"); }}
        />
        <TabButton
          label="Friends"
          icon="👥"
          active={view === "feed"}
          onClick={() => { setProfileHandle(null); setView("feed"); }}
        />
        <TabButton
          label="Me"
          icon="🙂"
          active={view === "profile" && profileHandle === null}
          onClick={() => { setProfileHandle(null); setView("profile"); }}
        />
      </nav>
    </div>
  );
}

interface TabButtonProps {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, icon, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        height: "100%",
        border: "none",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 700 : 500,
          color: active ? "#F59E0B" : "#92705A",
        }}
      >
        {label}
      </span>
    </button>
  );
}