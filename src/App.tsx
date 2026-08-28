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
// v81: top-level views are code-split so mobile cold starts do not
// eagerly parse the play, feed, own-profile, and public-profile trees.

import { lazy, Suspense, useState, useEffect } from "react";
import { ToastProvider } from "./pootbox/ui/ToastContext";
import { SOCIAL_FEATURES_ENABLED } from "./config/features";

const PootBox = lazy(() => import("./pootbox/PootBox"));
const Feed = lazy(() => import("./pootbox/components/Feed"));
const Profile = lazy(() => import("./pootbox/components/Profile"));
const PublicProfile = lazy(() => import("./pootbox/components/PublicProfile"));

type View = "play" | "feed" | "profile";

const VIEW_KEY = "pootbox-current-view-v1";
const PROFILE_HANDLE_KEY = "pootbox-profile-handle-v1";

function ViewFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        color: "var(--pb-muted)",
        fontFamily: "Fredoka, system-ui, sans-serif",
        fontWeight: 600,
      }}
    >
      Loading…
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    if (!SOCIAL_FEATURES_ENABLED) return "play";
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
    <ToastProvider>
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <Suspense fallback={<ViewFallback />}>
          {view === "play" && (
            <PootBox />
          )}
          {SOCIAL_FEATURES_ENABLED && view === "feed" && (
            <Feed
              onBack={() => setView("play")}
              onOpenProfile={(handle) => openPublicProfile(handle)}
            />
          )}
          {SOCIAL_FEATURES_ENABLED && view === "profile" && (
            profileHandle
              ? <PublicProfile handle={profileHandle} onBack={backToOwnProfile} onOpenFeed={() => setView("feed")} />
              : <Profile onBack={() => setView("play")} />
          )}
        </Suspense>

        {/* v79/v80: bottom tab bar. Fixed to the bottom of the viewport
            with safe-area-inset padding for iOS notches. */}
        <nav
          role="navigation"
          aria-label="App sections"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            minHeight: 64,
            height: "calc(64px + env(safe-area-inset-bottom, 0px))",
            background: "color-mix(in srgb, var(--pb-surface) 92%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid var(--pb-border)",
            display: "flex",
            alignItems: "stretch",
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
          {SOCIAL_FEATURES_ENABLED && (
            <>
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
            </>
          )}
        </nav>
      </div>
    </ToastProvider>
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
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="pb-hit"
      style={{
        flex: 1,
        minHeight: 64,
        border: "none",
        background: active ? "var(--pb-accent-soft)" : "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        cursor: "pointer",
        padding: "8px 4px",
        borderRadius: 12,
        margin: "4px 6px",
        transition: "background 160ms ease",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>{icon}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: active ? 700 : 600,
          color: active ? "var(--pb-accent-ink)" : "var(--pb-muted)",
        }}
      >
        {label}
      </span>
    </button>
  );
}
