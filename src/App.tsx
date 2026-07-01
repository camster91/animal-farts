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
// v80 rollback: the bottom tab bar (added in v79) is the prime
// suspect for a "buttons don't work" bug the user reported on
// 2026-06-30. PootBox's canvas wrapper is position:fixed and
// covers the viewport; the tab bar was a sibling, but the
// stacking-context interaction (z-index 100 nav inside an
// App.tsx wrapper with position:relative) may have been
// interfering with FirstRunIntro's z-index 200 overlay's
// pointer events. Removed the tab bar. Kid now has only the
// single-page Play view by default; Feed + Profile are
// reachable only via direct URL/handler (deferred — they're
// not critical for the kid product). PootBox, FirstRunIntro,
// and all other modals should work as before.

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
    </div>
  );
}