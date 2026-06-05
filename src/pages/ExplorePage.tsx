import { useState, useEffect, useCallback } from "react";
import { api, audioUrl, type User, type FeedEntry } from "../api";
import { playSound } from "../audio/fartEngine";
import { usePoof } from "../poofContext";

export default function ExplorePage({ me }: { me: User | null }) {
  const onPoof = usePoof();
  const [tab, setTab] = useState<"feed" | "people">("feed");
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    try {
      const [f, u] = await Promise.all([api.getFeed(50), api.listUsers()]);
      setFeed(f);
      setUsers(u);
      setFollowing(new Set(u.map((x) => x.handle).filter((h): h is string => !!h) as string[]));
    } catch (err) {
      console.warn("[explore] load:", err);
    } finally {
      setLoading(false);
    }
  }, [me?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onFollow = useCallback(async (handle: string) => {
    if (!me || !handle) return;
    try {
      const res = await api.follow(handle);
      setFollowing((s) => {
        const next = new Set(s);
        if (res.following) next.add(handle);
        else next.delete(handle);
        return next;
      });
    } catch (err) {
      console.warn("[explore] follow:", err);
    }
  }, [me?.id]);

  if (!me) {
    return <div className="px-4 py-8 text-slate-700">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-3 pb-2 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900">🌍 Explore</h1>
        <p className="text-sm text-slate-600">Latest farts from around the world</p>
      </header>

      <div className="px-3 max-w-3xl mx-auto w-full">
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTab("feed")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === "feed" ? "bg-amber-100 text-amber-900 border-2 border-amber-400" : "bg-white text-slate-600 border-2 border-slate-200"}`}>
            🎵 Feed
          </button>
          <button onClick={() => setTab("people")} className={`flex-1 py-2 rounded-lg font-bold text-sm ${tab === "people" ? "bg-amber-100 text-amber-900 border-2 border-amber-400" : "bg-white text-slate-600 border-2 border-slate-200"}`}>
            👥 People
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-3 pb-20 max-w-3xl mx-auto w-full">
        {loading && <div className="text-center text-slate-500 py-4">Loading…</div>}

        {tab === "feed" && !loading && (
          feed.length === 0 ? (
            <EmptyState
              emoji="🎙️"
              title="No farts in the feed yet"
              body="Be the first! Make a sound on the Sounds tab and post it public."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {feed.map((r) => (
                <FeedCard
                  key={r.id}
                  entry={r}
                  onPlay={(e) => {
                    void playSound(audioUrl(r.audioUrl.split("/").pop()!));
                    const point = "touches" in e
                      ? (e as any).changedTouches?.[0] ?? (e as any).touches?.[0]
                      : (e as any);
                    const x = point?.clientX ?? window.innerWidth / 2;
                    const y = point?.clientY ?? window.innerHeight / 2;
                    onPoof(x, y, "💨");
                  }}
                />
              ))}
            </div>
          )
        )}

        {tab === "people" && !loading && (
          users.filter((u) => u.id !== me.id).length === 0 ? (
            <EmptyState
              emoji="🌍"
              title="No other people yet"
              body="Be the first. Your profile is auto-created when you record a sound."
            />
          ) : (
            <div className="space-y-2">
              {users.filter((u) => u.id !== me.id).map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  following={u.handle ? following.has(u.handle) : false}
                  onFollow={() => u.handle && onFollow(u.handle)}
                />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function FeedCard({
  entry, onPlay,
}: {
  entry: FeedEntry;
  onPlay: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-100 p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{entry.posterAvatar || "👤"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-amber-950 truncate">
            {entry.posterName || entry.posterHandle || "Anonymous"}
          </div>
          {entry.posterHandle && (
            <div className="text-xs text-slate-500 truncate">@{entry.posterHandle}</div>
          )}
        </div>
      </div>
      <button
        onClick={onPlay}
        style={{ touchAction: "manipulation" }}
        className="w-full bg-gradient-to-br from-fuchsia-200 to-fuchsia-400 rounded-xl p-3 flex items-center gap-2 active:scale-95"
      >
        <div className="text-3xl">{entry.emoji}</div>
        <div className="flex-1 text-left">
          <div className="font-bold text-amber-950 truncate">{entry.name}</div>
          {entry.durationSec && <div className="text-xs text-amber-900/70">{entry.durationSec.toFixed(1)}s</div>}
        </div>
      </button>
    </div>
  );
}

function UserRow({ user, following, onFollow }: { user: User; following: boolean; onFollow: () => void }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-100 p-3 flex items-center gap-3">
      <div className="text-3xl">{user.avatar || "👤"}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-amber-950 truncate">
          {user.displayName || user.handle || "Anonymous"}
        </div>
        {user.handle && <div className="text-xs text-slate-500 truncate">@{user.handle}</div>}
        {user.bio && <div className="text-xs text-slate-600 truncate mt-0.5">{user.bio}</div>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs text-slate-500">{user.recordingCount} 🎵</div>
        {user.handle ? (
          <button
            onClick={onFollow}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold active:scale-95 ${following ? "bg-slate-200 text-slate-700" : "bg-pink-500 text-white"}`}
          >
            {following ? "Following" : "Follow"}
          </button>
        ) : (
          <div className="text-xs text-slate-400">no handle</div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="text-center py-12 text-slate-500">
      <div className="text-5xl mb-3">{emoji}</div>
      <p className="font-bold text-slate-700">{title}</p>
      <p className="text-sm">{body}</p>
    </div>
  );
}
