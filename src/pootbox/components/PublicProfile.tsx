// PublicProfile.tsx — v79: read-only profile for someone else.
// Triggered by tapping an author header in the Feed. Renders
// the same identity card as Profile (own), but without the
// edit affordances. Plus a "Recordings" list with play buttons.
//
// Endpoints used:
//   GET  /api/users/:handle           — public profile
//   POST /api/users/:handle/follow    — toggle follow
//   GET  /api/users/:handle/recordings — recordings by them

import { useState, useEffect } from "react";
import { getOrCreateDeviceId } from "../lib/deviceId";
import { playSingle, stopAllSounds, isAnySoundPlaying } from "../audioManager";

interface PublicUser {
  deviceId: string;
  handle: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  createdAt: number;
  followerCount: number;
  followingCount: number;
  recordingCount: number;
  isFollowing: boolean;
  isMe: boolean;
}

interface PublicRecording {
  id: number;
  name: string;
  emoji: string;
  durationSec: number | null;
  upvotes: number;
  userVoted: boolean;
  createdAt: number;
  audioUrl: string;
}

interface PublicProfileProps {
  handle: string;
  onBack: () => void;
  onOpenFeed?: () => void;
}

function formatRelative(ms: number): string {
  const dt = Date.now() - ms;
  if (dt < 60_000) return "just now";
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)}h ago`;
  return `${Math.floor(dt / 86_400_000)}d ago`;
}

export default function PublicProfile({ handle, onBack, onOpenFeed }: PublicProfileProps) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [recordings, setRecordings] = useState<PublicRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anythingPlaying, setAnythingPlaying] = useState(false);
  const [upvoteCounts, setUpvoteCounts] = useState<Record<number, { count: number; mine: boolean }>>({});

  // Fetch profile + recordings in parallel.
  useEffect(() => {
    if (!handle) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    Promise.all([
      fetch(`/api/users/${handle}`, { headers: { "x-device-id": getOrCreateDeviceId() } }),
      fetch(`/api/users/${handle}/recordings`, { headers: { "x-device-id": getOrCreateDeviceId() } }),
    ])
      .then(async ([profileRes, recRes]) => {
        if (cancelled) return;
        if (!profileRes.ok) throw new Error(`Profile HTTP ${profileRes.status}`);
        if (!recRes.ok) throw new Error(`Recordings HTTP ${recRes.status}`);
        const profile = await profileRes.json();
        const recsData = await recRes.json();
        setUser(profile);
        setRecordings(recsData.recordings ?? []);
        const counts: Record<number, { count: number; mine: boolean }> = {};
        for (const r of recsData.recordings ?? []) {
          counts[r.id] = { count: r.upvotes, mine: r.userVoted };
        }
        setUpvoteCounts(counts);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load profile — are you online?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [handle]);

  // Poll audioManager.
  useEffect(() => {
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      const playing = isAnySoundPlaying();
      setAnythingPlaying((prev) => prev === playing ? prev : playing);
    }
    const interval = setInterval(tick, 250);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  function handlePlay(rec: PublicRecording) {
    if (isAnySoundPlaying()) {
      stopAllSounds();
      setTimeout(() => playSingle(rec.audioUrl, 1, String(rec.id)), 50);
    } else {
      playSingle(rec.audioUrl, 1, String(rec.id));
    }
  }

  async function handleUpvote(rec: PublicRecording) {
    const prev = upvoteCounts[rec.id] ?? { count: rec.upvotes, mine: rec.userVoted };
    const newMine = !prev.mine;
    const newCount = prev.count + (newMine ? 1 : -1);
    setUpvoteCounts((p) => ({ ...p, [rec.id]: { count: newCount, mine: newMine } }));
    try {
      const r = await fetch(`/api/recordings/${rec.id}/upvote`, {
        method: "POST",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (!r.ok) setUpvoteCounts((p) => ({ ...p, [rec.id]: prev }));
    } catch {
      setUpvoteCounts((p) => ({ ...p, [rec.id]: prev }));
    }
  }

  async function handleFollowToggle() {
    if (!user || user.isMe) return;
    try {
      const r = await fetch(`/api/users/${user.handle}/follow`, {
        method: "POST",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (r.ok) {
        const data = await r.json();
        setUser((u) => u ? { ...u, isFollowing: data.following, followerCount: u.followerCount + (data.following ? 1 : -1) } : u);
      }
    } catch { /* offline — leave as is */ }
  }

  if (loading) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: 32, color: "#92705A" }}>Loading…</div>
      </Shell>
    );
  }
  if (error || !user) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: 32, color: "#BE185D" }}>
          {error || "Couldn't load profile"}
        </div>
      </Shell>
    );
  }

  const displayName = user.displayName ?? (user.handle ? `@${user.handle}` : "Someone");

  return (
    <Shell onBack={onBack}>
      {/* Identity card */}
      <section
        style={{
          margin: "0 16px 16px",
          padding: 16,
          borderRadius: 20,
          background: "rgba(255,255,255,0.9)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: "rgba(245,158,11,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              flexShrink: 0,
            }}
          >
            {user.avatar || "🙂"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#3D2C1E" }}>
              {displayName}
            </div>
            {user.handle && (
              <div style={{ fontSize: 12, color: "#92705A" }}>@{user.handle}</div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "#3D2C1E" }}>
              <span><strong>{user.recordingCount}</strong> recording{user.recordingCount === 1 ? "" : "s"}</span>
              <span><strong>{user.followerCount}</strong> follower{user.followerCount === 1 ? "" : "s"}</span>
              <span><strong>{user.followingCount}</strong> following</span>
            </div>
          </div>
        </div>
        {user.bio && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#3D2C1E", lineHeight: 1.4 }}>
            {user.bio}
          </p>
        )}
        {!user.isMe && user.handle && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleFollowToggle}
              aria-label={user.isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
              style={{
                appearance: "none",
                border: "none",
                background: user.isFollowing ? "rgba(0,0,0,0.06)" : "#F59E0B",
                color: user.isFollowing ? "#3D2C1E" : "white",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                padding: "10px 18px",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              {user.isFollowing ? "✓ Following" : "+ Follow"}
            </button>
          </div>
        )}
      </section>

      {/* Recordings list */}
      <section
        style={{
          margin: "0 16px 16px",
          padding: 16,
          borderRadius: 20,
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#3D2C1E" }}>
          Recordings
        </h2>
        {recordings.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "#92705A" }}>
            No recordings yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recordings.map((rec) => {
              const upvote = upvoteCounts[rec.id] ?? { count: rec.upvotes, mine: rec.userVoted };
              return (
                <div
                  key={rec.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 4px",
                    borderRadius: 10,
                  }}
                >
                  <button
                    onClick={() => handlePlay(rec)}
                    aria-label={`Play ${rec.name}`}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: anythingPlaying ? "#F59E0B" : "rgba(245,158,11,0.18)",
                      border: "none",
                      fontSize: 22,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {anythingPlaying ? "⏸" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#3D2C1E",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{rec.emoji}</span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rec.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#92705A", marginTop: 2 }}>
                      {formatRelative(rec.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpvote(rec)}
                    aria-label={upvote.mine ? `Remove upvote on ${rec.name}` : `Upvote ${rec.name}`}
                    style={{
                      appearance: "none",
                      border: "none",
                      background: "transparent",
                      color: upvote.mine ? "#F59E0B" : "#3D2C1E",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 6px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>👍</span>
                    <span>{upvote.count}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {onOpenFeed && recordings.length > 0 && (
        <div style={{ textAlign: "center", padding: "0 16px 16px" }}>
          <button
            onClick={onOpenFeed}
            aria-label={`Open ${displayName}'s recordings in the feed`}
            style={{
              appearance: "none",
              border: "none",
              background: "rgba(0,0,0,0.06)",
              color: "#3D2C1E",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            See in Friends
          </button>
        </div>
      )}
    </Shell>
  );
}

interface ShellProps {
  onBack: () => void;
  children: React.ReactNode;
}

function Shell({ onBack, children }: ShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "16px 0 80px",
        background: "linear-gradient(180deg, #FFF7ED 0%, #FEF3C7 100%)",
        fontFamily: "Fredoka, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px 16px",
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: "rgba(255,255,255,0.9)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "#3D2C1E",
          }}
        >
          Profile
        </h1>
      </div>
      {children}
    </div>
  );
}