import { useState, useEffect, useCallback } from "react";
import { api, type User } from "../api";
import { AVATARS } from "../avatars";

const KID_AVATARS = AVATARS.filter((a) => !a.adult);
const ADULT_AVATARS = AVATARS.filter((a) => a.adult);

export default function ProfilePage({
  me, onMe, onSwitchAccount,
}: {
  me: User | null;
  onMe: (u: User) => void;
  onSwitchAccount: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftHandle, setDraftHandle] = useState(me?.handle || "");
  const [draftName, setDraftName] = useState(me?.displayName || "");
  const [draftBio, setDraftBio] = useState(me?.bio || "");
  const [draftAvatar, setDraftAvatar] = useState(me?.avatar || "");
  const [draftIsAdult, setDraftIsAdult] = useState(me?.isAdult || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setDraftHandle(me.handle || "");
      setDraftName(me.displayName || "");
      setDraftBio(me.bio || "");
      setDraftAvatar(me.avatar || "");
      setDraftIsAdult(me.isAdult || false);
    }
  }, [me?.id, me?.handle, me?.displayName, me?.bio, me?.avatar, me?.isAdult]);

  const save = useCallback(async () => {
    if (!me) return;
    setSaving(true); setError(null);
    try {
      const updated = await api.updateMe({
        handle: draftHandle.trim() || undefined,
        displayName: draftName.trim() || undefined,
        bio: draftBio.trim() || undefined,
        avatar: draftAvatar || undefined,
        isAdult: draftIsAdult,
      });
      onMe(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [me, draftHandle, draftName, draftBio, draftAvatar, draftIsAdult, onMe]);

  if (!me) {
    return (
      <div className="px-4 py-8 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-amber-900 mb-2">👤 Profile</h1>
        <p className="text-slate-700">Loading…</p>
      </div>
    );
  }

  const avatars = me.isAdult ? ADULT_AVATARS : KID_AVATARS;

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto w-full overflow-y-auto pb-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-6xl">{me.avatar || "👤"}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-amber-900 truncate">
            {me.displayName || me.handle || "Anonymous"}
          </h1>
          <p className="text-sm text-slate-600 truncate">
            {me.handle ? `@${me.handle}` : "no handle yet"}
          </p>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-sm border-2 border-amber-300 active:scale-95"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <Stat label="Sounds" value={me.recordingCount} />
        <Stat label="Followers" value={me.followerCount} />
        <Stat label="Following" value={me.followingCount} />
      </div>

      {editing ? (
        <div className="bg-white rounded-2xl border-2 border-amber-200 p-4 space-y-3">
          {error && <div className="bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-2 text-sm">{error}</div>}

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Handle</label>
            <input
              value={draftHandle}
              onChange={(e) => setDraftHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
              placeholder="choose a handle"
              className="w-full mt-1 px-3 py-2 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, underscore. Up to 20 chars.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Display name</label>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value.slice(0, 30))}
              placeholder="shown on your profile"
              className="w-full mt-1 px-3 py-2 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Bio</label>
            <textarea
              value={draftBio}
              onChange={(e) => setDraftBio(e.target.value.slice(0, 120))}
              placeholder="(optional)"
              rows={2}
              className="w-full mt-1 px-3 py-2 border-2 border-amber-200 rounded-lg focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase">Avatar</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {avatars.map((a) => (
                <button
                  key={a.emoji}
                  onClick={() => setDraftAvatar(a.emoji)}
                  className={`text-3xl p-1.5 rounded-lg border-2 active:scale-95 ${draftAvatar === a.emoji ? "bg-amber-100 border-amber-500" : "bg-white border-slate-200"}`}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draftIsAdult} onChange={(e) => setDraftIsAdult(e.target.checked)} className="w-5 h-5" />
            <span className="text-slate-700">I'm 13+ (shows grown-up avatars and lets me see grown-up content)</span>
          </label>

          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-gradient-to-br from-pink-500 to-purple-500 text-white font-extrabold py-3 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        me.bio && (
          <p className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-slate-800 text-sm whitespace-pre-wrap">
            {me.bio}
          </p>
        )
      )}

      <div className="mt-4 pt-4 border-t border-slate-200">
        <button
          onClick={onSwitchAccount}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Switch device / reset profile
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-amber-200 p-3">
      <div className="text-2xl font-extrabold text-amber-900">{value}</div>
      <div className="text-xs text-slate-600 uppercase font-bold">{label}</div>
    </div>
  );
}
