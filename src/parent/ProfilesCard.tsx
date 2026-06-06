// Card 4: Kid profiles — list, add, edit, delete
import { useState, useRef } from 'react';
import type { Profile } from './types';

const AVATAR_OPTIONS = ['🐷', '🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🐵', '🐷'];

interface Props {
  profiles: Profile[];
  activeProfileId: string;
  onAdd: (name: string, avatar: string) => void;
  onUpdate: (id: string, updates: Partial<Profile>) => void;
  onDelete: (id: string) => void;
}

export default function ProfilesCard({ profiles, activeProfileId, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('🐷');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd(newName.trim(), newAvatar);
    setNewName('');
    setNewAvatar('🐷');
    setAdding(false);
  }

  function handleTouchStart(id: string) {
    longPressTimer.current = setTimeout(() => {
      setDeleteConfirm(id);
    }, 600);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">👶</span>
        <div>
          <h2 className="font-bold text-amber-900">Kid profiles</h2>
          <p className="text-xs text-amber-600">Long-press to delete a profile</p>
        </div>
      </div>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
              profile.id === activeProfileId
                ? 'border-amber-400 bg-amber-50'
                : 'border-amber-100 bg-amber-50/50'
            }`}
            onTouchStart={() => handleTouchStart(profile.id)}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart(profile.id)}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
          >
            <span className="text-3xl" role="img" aria-label={profile.name}>
              {profile.avatar}
            </span>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={profile.name}
                onChange={(e) => onUpdate(profile.id, { name: e.target.value })}
                className="w-full bg-transparent font-bold text-amber-900 focus:outline-none focus:border-b border-amber-400"
 />
              <p className="text-xs text-amber-500 mt-0.5">
                {profile.recordingsCount} recordings
              </p>
            </div>
            {profile.id === activeProfileId && (
              <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-medium">
                Active
              </span>
            )}
          </div>
        ))}
      </div>

      {deleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 font-medium mb-2">
            Delete "{profiles.find((p) => p.id === deleteConfirm)?.name}"?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete(deleteConfirm);
                setDeleteConfirm(null);
              }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2 rounded-xl transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold py-2 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {adding ? (
        <div className="mt-3 p-3 border-2 border-amber-300 rounded-xl bg-amber-50">
          <label className="block mb-2">
            <span className="text-xs text-amber-600 block mb-1">Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Kid's name"
              className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-amber-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          </label>
          <div className="mb-3">
            <span className="text-xs text-amber-600 block mb-1">Avatar</span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setNewAvatar(emoji)}
                  className={`text-2xl p-1 rounded-lg transition-colors ${
                    newAvatar === emoji ? 'bg-amber-300' : 'hover:bg-amber-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold py-2 rounded-xl transition-colors"
            >
              Add profile
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(''); }}
              className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-bold py-2 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full mt-3 border-2 border-dashed border-amber-300 hover:border-amber-500 text-amber-600 hover:text-amber-800 font-medium text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
 ➕ Add kid
        </button>
      )}
    </div>
  );
}
