// Parent dashboard store — localStorage-backed React state
import { useState, useEffect, useCallback } from 'react';
import type { ParentSettings, Profile } from './types';
import { DEFAULT_PARENT_SETTINGS } from './types';

const STORAGE_KEY = 'poot-party-parent-settings';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `POOT-${code}`;
}

function loadSettings(): ParentSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ParentSettings>;
      // Detect day rollover for recording count
      const todayStr = today();
      if (parsed.recordingCountDate !== todayStr) {
        parsed.recordingCountToday = 0;
        parsed.recordingCountDate = todayStr;
      }
      return { ...DEFAULT_PARENT_SETTINGS, ...parsed };
    }
  } catch { /* ignore */ }
  return {
    ...DEFAULT_PARENT_SETTINGS,
    recordingCountDate: today(),
    shareCode: generateShareCode(),
  };
}

function saveSettings(s: ParentSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useParentStore() {
  const [settings, setSettings] = useState<ParentSettings>(loadSettings);

  // Auto-save on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // --- PIN ---
  const setPin = useCallback((pin: string) => {
    setSettings((s) => ({ ...s, pin, hasSetupPin: true }));
  }, []);

  const changePin = useCallback((newPin: string) => {
    setSettings((s) => ({ ...s, pin: newPin }));
  }, []);

  // --- Quiet hours ---
  const setQuietHours = useCallback((quietHours: ParentSettings['quietHours']) => {
    setSettings((s) => ({ ...s, quietHours }));
  }, []);

  // --- Recording limit ---
  const setRecordingLimit = useCallback((recordingLimit: number) => {
    setSettings((s) => ({ ...s, recordingLimit: Math.max(1, Math.min(20, recordingLimit)) }));
  }, []);

  const resetRecordingCount = useCallback(() => {
    setSettings((s) => ({ ...s, recordingCountToday: 0, recordingCountDate: today() }));
  }, []);

  const incrementRecordingCount = useCallback(() => {
    setSettings((s) => {
      const todayStr = today();
      const count = s.recordingCountDate === todayStr ? s.recordingCountToday + 1 : 1;
      return { ...s, recordingCountToday: count, recordingCountDate: todayStr };
    });
  }, []);

  // --- Voice effects ---
  const setEffects = useCallback((effects: ParentSettings['effects']) => {
    setSettings((s) => ({ ...s, effects }));
  }, []);

  // --- Profiles ---
  const addProfile = useCallback((name: string, avatar: string) => {
    const newProfile: Profile = {
      id: `profile-${Date.now()}`,
      name,
      avatar,
      recordingsCount: 0,
      createdAt: Date.now(),
    };
    setSettings((s) => ({ ...s, profiles: [...s.profiles, newProfile] }));
 }, []);

  const updateProfile = useCallback((id: string, updates: Partial<Profile>) => {
    setSettings((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setSettings((s) => {
      const profiles = s.profiles.filter((p) => p.id !== id);
      // Ensure at least one profile exists
      if (profiles.length === 0) {
        profiles.push({
          id: 'default',
          name: 'Kid',
          avatar: '🐷',
          recordingsCount: 0,
          createdAt: Date.now(),
        });
      }
      const activeProfileId = s.activeProfileId === id ? profiles[0].id : s.activeProfileId;
      return { ...s, profiles, activeProfileId };
    });
  }, []);

  // --- Share code ---
  const regenerateShareCode = useCallback(() => {
    setSettings((s) => ({ ...s, shareCode: generateShareCode() }));
  }, []);

  const copyShareCode = useCallback(async () => {
    if (settings.shareCode) {
      await navigator.clipboard.writeText(settings.shareCode);
    }
  }, [settings.shareCode]);

  // --- Premium ---
  const setPremium = useCallback((isPremium: boolean) => {
    setSettings((s) => ({ ...s, isPremium }));
  }, []);

  return {
    settings,
    setPin,
    changePin,
    setQuietHours,
    setRecordingLimit,
    resetRecordingCount,
    incrementRecordingCount,
    setEffects,
    addProfile,
    updateProfile,
    deleteProfile,
    regenerateShareCode,
    copyShareCode,
    setPremium,
  };
}
