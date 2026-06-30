// Profile.tsx — v79: own profile + edit + followers list.
// Built on top of:
//   GET    /api/me             — current user (creates if missing)
//   PATCH  /api/me             — update displayName/avatar/bio/handle
//   GET    /api/users/:handle  — public profile
//   GET    /api/users/:handle/followers
//   GET    /api/users/:handle/following
//   GET    /api/users/:handle/recordings
//   POST   /api/users/:handle/follow — toggle follow
//
// The kid's device-id auto-creates a user record (via getOrCreateUser
// on the server's GET /api/me). Without a handle set, they're
// "anonymous" (server returns handle: null). The screen prompts
// for a handle on first visit so they have a stable share URL.

import { useState, useEffect } from "react";
import { getOrCreateDeviceId } from "../lib/deviceId";

interface UserPublic {
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

interface ProfileProps {
  onBack: () => void;
}

export default function Profile({ onBack }: ProfileProps) {
  const [me, setMe] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: "", bio: "", handle: "" });
  const [saving, setSaving] = useState(false);

  // Fetch /api/me on mount.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetch("/api/me", { headers: { "x-device-id": getOrCreateDeviceId() } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setDraft({
          displayName: data.displayName ?? "",
          bio: data.bio ?? "",
          handle: data.handle ?? "",
        });
      })
      .catch(() => {
        if (cancelled) return;
        setError("Couldn't load your profile — are you online?");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/me", {
        method: "PATCH",
        headers: {
          "x-device-id": getOrCreateDeviceId(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName: draft.displayName,
          bio: draft.bio,
          handle: draft.handle,
        }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        setError(errBody.error || `HTTP ${r.status}`);
        return;
      }
      const updated = await r.json();
      setMe(updated);
      setEditing(false);
    } catch {
      setError("Couldn't save — are you online?");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: 32, color: "#92705A" }}>Loading…</div>
      </Shell>
    );
  }
  if (error || !me) {
    return (
      <Shell onBack={onBack}>
        <div style={{ textAlign: "center", padding: 32, color: "#BE185D" }}>
          {error || "Couldn't load profile"}
        </div>
      </Shell>
    );
  }

  const displayName = me.displayName ?? (me.handle ? `@${me.handle}` : "You");
  const showHandlePrompt = !me.handle;

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
            {me.avatar || "🙂"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#3D2C1E" }}>
              {displayName}
            </div>
            {me.handle && (
              <div style={{ fontSize: 12, color: "#92705A" }}>@{me.handle}</div>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12, color: "#3D2C1E" }}>
              <span><strong>{me.recordingCount}</strong> recording{me.recordingCount === 1 ? "" : "s"}</span>
              <span><strong>{me.followerCount}</strong> follower{me.followerCount === 1 ? "" : "s"}</span>
              <span><strong>{me.followingCount}</strong> following</span>
            </div>
          </div>
        </div>
        {me.bio && !editing && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#3D2C1E", lineHeight: 1.4 }}>
            {me.bio}
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              aria-label="Edit profile"
              style={{
                appearance: "none",
                border: "none",
                background: "#F59E0B",
                color: "white",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Edit profile
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <FieldRow
                label="Display name"
                value={draft.displayName}
                onChange={(v) => setDraft((d) => ({ ...d, displayName: v }))}
                placeholder="Your name"
                maxLength={30}
              />
              <FieldRow
                label="Handle"
                value={draft.handle}
                onChange={(v) => setDraft((d) => ({ ...d, handle: v.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                placeholder="kid-name"
                maxLength={20}
              />
              <FieldRow
                label="Bio"
                value={draft.bio}
                onChange={(v) => setDraft((d) => ({ ...d, bio: v }))}
                placeholder="Say something nice…"
                maxLength={200}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  aria-label="Save profile"
                  style={{
                    appearance: "none",
                    border: "none",
                    background: saving ? "rgba(0,0,0,0.15)" : "#F59E0B",
                    color: "white",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 14px",
                    borderRadius: 10,
                    cursor: saving ? "default" : "pointer",
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    if (me) setDraft({ displayName: me.displayName ?? "", bio: me.bio ?? "", handle: me.handle ?? "" });
                  }}
                  aria-label="Cancel edit"
                  style={{
                    appearance: "none",
                    border: "none",
                    background: "rgba(0,0,0,0.06)",
                    color: "#3D2C1E",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 14px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        {showHandlePrompt && !editing && (
          <p style={{ margin: "10px 0 0", padding: 10, background: "rgba(245,158,11,0.12)", borderRadius: 10, fontSize: 12, color: "#92400E" }}>
            Pick a handle so friends can find you by typing{" "}
            <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 4 }}>
              @{draft.handle || "your-name"}
            </code>
            .
          </p>
        )}
      </section>

      {/* Recordings list (placeholder — server endpoint exists,
          full list with play buttons can be a follow-up) */}
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
          Your recordings
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#92705A" }}>
          Visit the Play tab to see and edit your custom recordings.
          Friends will see them here once they follow you.
        </p>
      </section>
    </Shell>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}

function FieldRow({ label, value, onChange, placeholder, maxLength }: FieldRowProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#92705A" }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength ?? Infinity))}
        placeholder={placeholder}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.10)",
          fontFamily: "inherit",
          fontSize: 14,
          color: "#3D2C1E",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </label>
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
          You
        </h1>
      </div>
      {children}
    </div>
  );
}