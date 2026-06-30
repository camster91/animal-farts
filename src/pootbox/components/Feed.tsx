// Feed.tsx — v79: "/api/feed" view. Instagram-style grouped
// feed: one group per author, each containing the author's
// recent recordings. Tapping a recording plays it (via the
// shared audioManager, single-voice). The view is mounted by
// App.tsx as one of 3 top-level routes: play (default), feed,
// profile.
//
// The server endpoint uses usersToPublicBatch (v74 + v79) so
// the per-author counts come back in 1 query. The client
// just renders whatever the server returned.

import { useState, useEffect } from "react";
import { playSingle, stopAllSounds, isAnySoundPlaying } from "../audioManager";
import { getOrCreateDeviceId } from "../lib/deviceId";

interface AuthorPublic {
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
  /** v79: server-side device_id is needed for keying the feed
   *  group. The server's usersToPublicBatch returns it. */
  deviceId?: string;
}

interface FeedRecording {
  id: number;
  name: string;
  emoji: string;
  durationSec: number | null;
  upvotes: number;
  userVoted: boolean;
  createdAt: number;
  audioUrl: string;
}

interface FeedGroup {
  author: AuthorPublic;
  recordings: FeedRecording[];
}

function formatRelative(ms: number): string {
  const dt = Date.now() - ms;
  if (dt < 60_000) return "just now";
  if (dt < 3_600_000) return `${Math.floor(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.floor(dt / 3_600_000)}h ago`;
  return `${Math.floor(dt / 86_400_000)}d ago`;
}

interface FeedProps {
  onBack: () => void;
}

export default function Feed({ onBack }: FeedProps) {
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anythingPlaying, setAnythingPlaying] = useState(false);
  // Upvote state per recording id (local). When the kid taps
  // upvote, we POST and update local state. The server returns
  // the new counts in the response.
  const [upvoteCounts, setUpvoteCounts] = useState<Record<number, { count: number; mine: boolean }>>({});

  // Fetch the feed.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetch("/api/feed", { headers: { "x-device-id": getOrCreateDeviceId() } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setGroups(data.groups ?? []);
        // Pre-populate upvote counts so the first render shows them.
        const initialCounts: Record<number, { count: number; mine: boolean }> = {};
        for (const g of (data.groups ?? [])) {
          for (const rec of g.recordings) {
            initialCounts[rec.id] = { count: rec.upvotes, mine: rec.userVoted };
          }
        }
        setUpvoteCounts(initialCounts);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load feed — are you online?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Poll audioManager.isAnySoundPlaying() so we can show the
  // ▶/⏸ toggle on the play button. The audioManager is shared
  // with PootBox (single-voice policy) — we don't try to track
  // WHICH feed recording is playing, just whether anything is.
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

  function handlePlay(rec: FeedRecording) {
    if (isAnySoundPlaying()) {
      stopAllSounds();
      // Tiny pause to let audioManager clear, then start new.
      setTimeout(() => playSingle(rec.audioUrl, 1, String(rec.id)), 50);
    } else {
      playSingle(rec.audioUrl, 1, String(rec.id));
    }
  }

  async function handleUpvote(rec: FeedRecording) {
    const prev = upvoteCounts[rec.id] ?? { count: rec.upvotes, mine: rec.userVoted };
    const newMine = !prev.mine;
    const newCount = prev.count + (newMine ? 1 : -1);
    setUpvoteCounts((p) => ({ ...p, [rec.id]: { count: newCount, mine: newMine } }));
    try {
      const r = await fetch(`/api/recordings/${rec.id}/upvote`, {
        method: "POST",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (!r.ok) {
        // Revert on failure.
        setUpvoteCounts((p) => ({ ...p, [rec.id]: prev }));
      }
    } catch {
      setUpvoteCounts((p) => ({ ...p, [rec.id]: prev }));
    }
  }

  async function handleFollowToggle(author: AuthorPublic) {
    if (author.isMe || !author.handle) return;
    try {
      const r = await fetch(`/api/users/${author.handle}/follow`, {
        method: "POST",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (r.ok) {
        const data = await r.json();
        // Update local state optimistically.
        setGroups((prev) => prev.map((g) => {
          if (g.author.handle !== author.handle) return g;
          return { ...g, author: { ...g.author, isFollowing: data.following } };
        }));
      }
    } catch { /* offline — leave as is */ }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FFF7ED 0%, #FEF3C7 100%)",
        fontFamily: "Fredoka, system-ui, sans-serif",
        padding: "16px 0 80px",
      }}
    >
      {/* Header */}
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
          aria-label="Back to play"
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
          Friends
        </h1>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 32, color: "#92705A" }}>Loading…</div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: 32, color: "#BE185D" }}>{error}</div>
      )}
      {!loading && !error && groups.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#92705A" }}>
          Your feed is empty. Record something yourself or share a code
          with a friend to find them here.
        </div>
      )}
      {!loading && !error && groups.map((group) => {
        const a = group.author;
        const displayName = a.displayName || a.handle || "Someone";
        return (
          <section
            key={a.handle || a.deviceId}
            style={{
              margin: "0 16px 16px",
              padding: 12,
              borderRadius: 16,
              background: "rgba(255,255,255,0.85)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {/* Author header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: "rgba(245,158,11,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                {a.avatar || "🐾"}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#3D2C1E",
                  }}
                >
                  {displayName}
                  {a.handle && (
                    <span style={{ color: "#92705A", fontWeight: 400, fontSize: 12, marginLeft: 4 }}>
                      @{a.handle}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#92705A" }}>
                  {a.recordingCount} recording{a.recordingCount === 1 ? "" : "s"} ·{" "}
                  {a.followerCount} follower{a.followerCount === 1 ? "" : "s"}
                </div>
              </div>
              {!a.isMe && a.handle && (
                <button
                  onClick={() => handleFollowToggle(a)}
                  aria-label={a.isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
                  style={{
                    appearance: "none",
                    border: "none",
                    background: a.isFollowing ? "rgba(0,0,0,0.06)" : "#F59E0B",
                    color: a.isFollowing ? "#3D2C1E" : "white",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  {a.isFollowing ? "Following" : "Follow"}
                </button>
              )}
            </div>

            {/* Recordings list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.recordings.map((rec) => {
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
                      <span style={{ fontSize: 16 }}>{upvote.mine ? "👍" : "👍"}</span>
                      <span>{upvote.count}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}