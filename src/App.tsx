import { useState, useEffect, useCallback, useRef } from "react";
import { api, type User } from "./api";
import { FxProvider } from "./fxContext";
import { PoofProvider } from "./poofContext";
import SoundsPage from "./pages/SoundsPage";
import MySoundsPage from "./pages/MySoundsPage";
import ExplorePage from "./pages/ExplorePage";
import ProfilePage from "./pages/ProfilePage";

type Tab = "sounds" | "my" | "explore" | "profile";

export default function App() {
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("sounds");
  const [poofs, setPoofs] = useState<{ id: number; x: number; y: number; emoji: string }[]>([]);
  const nextPoofId = useRef(0);

  useEffect(() => {
    api.getMe()
      .then(setMe)
      .catch((err) => {
        console.warn("[app] getMe:", err);
        setMe({
          id: 0, deviceId: "fallback", handle: null, displayName: null, avatar: "👤",
          isAdult: false, bio: null, followerCount: 0, followingCount: 0, recordingCount: 0,
        });
      });
  }, []);

  const onPoof = useCallback((x: number, y: number, emoji: string) => {
    const id = nextPoofId.current++;
    setPoofs((p) => [...p.slice(-5), { id, x, y, emoji }]);
    window.setTimeout(() => {
      setPoofs((p) => p.filter((pf) => pf.id !== id));
    }, 700);
  }, []);

  const onMeChange = useCallback((u: User) => setMe(u), []);

  const onSwitchAccount = useCallback(() => {
    if (!confirm("Reset your profile? This clears the device ID and creates a new profile.")) return;
    localStorage.removeItem("emoji-farts-device-id");
    location.reload();
  }, []);

  return (
    <FxProvider>
      <PoofProvider value={onPoof}>
        <div
          className="min-h-screen flex flex-col"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {/* Page content. v25w: Sounds tab uses absolute inset-0
              (full-bleed) so the scene background fills the viewport.
              My/Explore/Profile have their own layouts with normal
              padding. */}
          <div className={`flex-1 relative ${tab === "sounds" ? "overflow-hidden" : "overflow-y-auto pb-20"}`}>
            {tab === "sounds" && <SoundsPage />}
            {tab === "my" && <MySoundsPage me={me} />}
            {tab === "explore" && <ExplorePage me={me} />}
            {tab === "profile" && (
              <ProfilePage me={me} onMe={onMeChange} onSwitchAccount={onSwitchAccount} />
            )}
          </div>

          {/* Bottom nav — for parents to access recordings/profile. */}
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t-2 border-amber-200"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex max-w-3xl mx-auto">
              <TabButton tab="sounds" current={tab} onClick={setTab} emoji="💨" label="Play" />
              <TabButton tab="my" current={tab} onClick={setTab} emoji="🎤" label="My Sounds" />
              <TabButton tab="explore" current={tab} onClick={setTab} emoji="🌍" label="Explore" />
              <TabButton tab="profile" current={tab} onClick={setTab} emoji="👤" label="Me" />
            </div>
          </nav>

          {poofs.map((p) => (
            <div
              key={p.id}
              className="pointer-events-none fixed text-3xl poof-rise"
              style={{ left: p.x - 12, top: p.y - 12, zIndex: 50 }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      </PoofProvider>
    </FxProvider>
  );
}

function TabButton({
  tab, current, onClick, emoji, label,
}: {
  tab: Tab; current: Tab; onClick: (t: Tab) => void;
  emoji: string; label: string;
}) {
  const active = tab === current;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`flex-1 flex flex-col items-center justify-center py-2 active:scale-95 ${active ? "text-amber-900" : "text-slate-500"}`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-bold mt-0.5">{label}</span>
    </button>
  );
}
