// Poot Party — HomeScene. v26d.
// Profile picker home scene shown at app launch.
// Shown when no profile is selected; the kid picks a profile or creates one.

import { useState, useEffect, useCallback } from "react";
import { getKidStorage } from "./useKidStorage";
import type { Profile } from "./useKidStorage";
import { ProfileCard } from "./ProfileCard";
import { NewProfileModal } from "./NewProfileModal";
import { WelcomeScreen } from "./WelcomeScreen";

interface Props {
  onSelectProfile: (profile: Profile) => void;
}

interface ProfileWithCount {
  profile: Profile;
  heardCount: number;
}

export function HomeScene({ onSelectProfile }: Props) {
  // Initialize from localStorage on first render so the welcome screen
  // mounts immediately (no useEffect timing race in React 19 strict mode).
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('poot-party-welcome-seen');
    } catch {
      return true;
    }
  });
  const [profiles, setProfiles] = useState<ProfileWithCount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const storage = getKidStorage();

  // Load all profiles + their heard counts
  const loadProfiles = useCallback(async () => {
    const all = await storage.getAllProfiles();
    const withCounts = await Promise.all(
      all.map(async profile => ({
        profile,
        heardCount: await storage.getHeardCount(profile.id),
      }))
    );
    setProfiles(withCounts);
  }, [storage]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleCreate = useCallback(
    async (profile: Profile) => {
      await storage.saveProfile(profile);
      setShowModal(false);
      onSelectProfile(profile);
    },
    [storage, onSelectProfile]
  );

  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
    try {
      localStorage.setItem('poot-party-welcome-seen', '1');
    } catch { /* ignore */ }
  }, []);

  return (
    <>
      {/* Welcome screen — shown once per device before profile picker */}
      {showWelcome && <WelcomeScreen onDismiss={handleWelcomeDismiss} />}

      {/* Full-bleed home background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url(/scenes/home.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: "12vh",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: "8vh",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "clamp(28px, 6vw, 48px)",
              fontWeight: 900,
              color: "#fff",
              textShadow: "0 3px 12px rgba(0,0,0,0.35)",
              letterSpacing: -0.5,
            }}
          >
            Poot Party! 💨
          </div>
        </div>

        {/* Cards row */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          {/* Existing profile cards */}
          {profiles.map(({ profile, heardCount }) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              heardCount={heardCount}
              onSelect={onSelectProfile}
            />
          ))}

          {/* New kid card */}
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.25)",
              borderRadius: 24,
              padding: "20px 16px 16px",
              border: "3px dashed rgba(255,255,255,0.7)",
              cursor: "pointer",
              minWidth: 100,
              maxWidth: 120,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition: "transform 120ms, background 120ms",
              fontFamily: "inherit",
            }}
            onPointerDown={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.45)";
            }}
            onPointerUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)";
            }}
            onPointerLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.25)";
            }}
          >
            <div
              style={{
                fontSize: 48,
                lineHeight: 1,
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.5)",
                border: "3px dashed rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              +
            </div>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            >
              New kid
            </span>
          </button>
        </div>
      </div>

      {/* Create profile modal */}
      {showModal && (
        <NewProfileModal
          onCreate={handleCreate}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}