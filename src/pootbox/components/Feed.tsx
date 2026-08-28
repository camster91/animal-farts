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
import { serverUrl } from "../lib/serverUrl";
import { FeedSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import InlineBanner from "../ui/InlineBanner";
import { useAppToast } from "../ui/useAppToast";

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
  /** v79: called when the kid taps an author header in the feed.
   *  The parent (App.tsx) navigates to the public profile view. */
  onOpenProfile?: (handle: string) => void;
}

export default function Feed({ onBack, onOpenProfile }: FeedProps) {
  const { showToast } = useAppToast();
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anythingPlaying, setAnythingPlaying] = useState(false);
  // Upvote state per recording id (local). When the kid taps
  // upvote, we POST and update local state. The server returns
  // the new counts in the response.
  const [upvoteCounts, setUpvoteCounts] = useState<Record<number, { count: number; mine: boolean }>>({});

  function mergeFeedPage(data: { groups?: FeedGroup[]; nextCursor?: string | null }, append: boolean) {
    const incoming = data.groups ?? [];
    setNextCursor(data.nextCursor ?? null);
    const initialCounts: Record<number, { count: number; mine: boolean }> = {};
    for (const g of incoming) {
      for (const rec of g.recordings) {
        initialCounts[rec.id] = { count: rec.upvotes, mine: rec.userVoted };
      }
    }
    setUpvoteCounts((prev) => (append ? { ...prev, ...initialCounts } : initialCounts));
    setGroups((prev) => {
      if (!append) return incoming;
      const byHandle = new Map(prev.map((g) => [g.author.handle || g.author.displayName || "", g]));
      for (const g of incoming) {
        const key = g.author.handle || g.author.displayName || "";
        const existing = byHandle.get(key);
        if (!existing) {
          byHandle.set(key, g);
          continue;
        }
        const seen = new Set(existing.recordings.map((r) => r.id));
        const mergedRecs = [
          ...existing.recordings,
          ...g.recordings.filter((r) => !seen.has(r.id)),
        ];
        byHandle.set(key, { ...existing, recordings: mergedRecs, author: g.author });
      }
      // Preserve order: existing groups first, then new author keys.
      const order: string[] = [];
      const seenKeys = new Set<string>();
      for (const g of prev) {
        const k = g.author.handle || g.author.displayName || "";
        if (!seenKeys.has(k)) { order.push(k); seenKeys.add(k); }
      }
      for (const g of incoming) {
        const k = g.author.handle || g.author.displayName || "";
        if (!seenKeys.has(k)) { order.push(k); seenKeys.add(k); }
      }
      return order.map((k) => byHandle.get(k)!).filter(Boolean);
    });
  }

  // Fetch the feed.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(serverUrl("/api/feed?limit=30"), { headers: { "x-device-id": getOrCreateDeviceId() } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        mergeFeedPage(data, false);
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

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(
        serverUrl(`/api/feed?limit=30&cursor=${encodeURIComponent(nextCursor)}`),
        { headers: { "x-device-id": getOrCreateDeviceId() } },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      mergeFeedPage(data, true);
    } catch {
      setError("Couldn't load more — are you online?");
    } finally {
      setLoadingMore(false);
    }
  }

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
      const r = await fetch(serverUrl(`/api/recordings/${rec.id}/upvote`), {
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
    const prevFollowing = author.isFollowing;
    // Optimistic flip
    setGroups((prev) => prev.map((g) => {
      if (g.author.handle !== author.handle) return g;
      const nextFollowing = !prevFollowing;
      return {
        ...g,
        author: {
          ...g.author,
          isFollowing: nextFollowing,
          followerCount: Math.max(0, g.author.followerCount + (nextFollowing ? 1 : -1)),
        },
      };
    }));
    try {
      const r = await fetch(serverUrl(`/api/users/${author.handle}/follow`), {
        method: "POST",
        headers: { "x-device-id": getOrCreateDeviceId() },
      });
      if (!r.ok) throw new Error("follow failed");
      const data = await r.json();
      setGroups((prev) => prev.map((g) => {
        if (g.author.handle !== author.handle) return g;
        return { ...g, author: { ...g.author, isFollowing: data.following } };
      }));
      showToast(data.following ? `Following ${author.displayName || author.handle}` : "Unfollowed", {
        variant: "success",
      });
    } catch {
      // Revert
      setGroups((prev) => prev.map((g) => {
        if (g.author.handle !== author.handle) return g;
        return {
          ...g,
          author: {
            ...g.author,
            isFollowing: prevFollowing,
            followerCount: author.followerCount,
          },
        };
      }));
      showToast("Couldn't update follow — are you online?", { variant: "error" });
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, var(--pb-bg-0) 0%, var(--pb-bg-1) 100%)",
        fontFamily: "Fredoka, system-ui, sans-serif",
        padding: "16px 0 80px",
        color: "var(--pb-ink)",
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
          type="button"
          onClick={onBack}
          aria-label="Back to play"
          className="pb-hit"
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 14,
            border: "none",
            background: "var(--pb-surface)",
            boxShadow: "var(--pb-shadow)",
            fontSize: 18,
            cursor: "pointer",
            color: "var(--pb-ink)",
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: "1.4rem",
            fontWeight: 700,
            color: "var(--pb-ink)",
          }}
        >
          Friends
        </h1>
      </div>

      {loading && <FeedSkeleton />}
      {error && (
        <InlineBanner message={error} onDismiss={() => setError(null)} />
      )}
      {!loading && !error && groups.length === 0 && (
        <EmptyState
          icon="👥"
          title="Your feed is quiet"
          body="Record a sound, or open a friend’s share code to find them here."
        />
      )}
      {!loading && !error && groups.map((group) => {
        const a = group.author;
        const displayName = a.displayName || a.handle || "Someone";
        return (
          <section
            key={a.handle || a.displayName || "author"}
            className="pb-enter"
            style={{
              margin: "0 16px 16px",
              padding: 12,
              borderRadius: 16,
              background: "var(--pb-surface)",
              boxShadow: "var(--pb-shadow)",
            }}
          >
            {/* Author header */}
            <div
              onClick={() => {
                if (a.handle && onOpenProfile && !a.isMe) onOpenProfile(a.handle);
              }}
              role={a.handle && onOpenProfile && !a.isMe ? "button" : undefined}
              tabIndex={a.handle && onOpenProfile && !a.isMe ? 0 : undefined}
              onKeyDown={(e) => {
                if (!a.handle || !onOpenProfile || a.isMe) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenProfile(a.handle);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                cursor: a.handle && onOpenProfile && !a.isMe ? "pointer" : "default",
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
                  type="button"
                  className="pb-hit"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFollowToggle(a);
                  }}
                  aria-label={a.isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
                  aria-pressed={a.isFollowing}
                  style={{
                    appearance: "none",
                    border: "none",
                    background: a.isFollowing ? "var(--pb-border)" : "var(--pb-accent)",
                    color: a.isFollowing ? "var(--pb-ink)" : "var(--pb-accent-ink)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "0 14px",
                    minHeight: 44,
                    minWidth: 96,
                    borderRadius: 14,
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
      {nextCursor && !loading && !error && (
        <div style={{ textAlign: "center", padding: "8px 16px 24px" }}>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              appearance: "none",
              border: "none",
              background: "rgba(245,158,11,0.2)",
              color: "#3D2C1E",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 20px",
              borderRadius: 14,
              cursor: loadingMore ? "wait" : "pointer",
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
