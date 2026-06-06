// Parent dashboard types

export interface Profile {
  id: string;
  name: string;
  avatar: string; // emoji
  recordingsCount: number;
  createdAt: number;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string; // "HH:MM" 24h
  endTime: string;   // "HH:MM" 24h
}

export interface VoiceEffects {
  pitch: number;    // -6 to +6 semitones
  speed: number;    // 0.5–2.0
  reverb: boolean;
}

export interface ParentSettings {
  pin: string; // 4-digit PIN, stored as plain string (kids' app)
  hasSetupPin: boolean;
  quietHours: QuietHours;
  recordingLimit: number; // 1–20 per day
  recordingCountToday: number;
  recordingCountDate: string; // "YYYY-MM-DD" to detect day rollover
  effects: VoiceEffects;
  profiles: Profile[];
  activeProfileId: string;
  shareCode: string; // e.g. "POOT-7K2M"
}

export const DEFAULT_PARENT_SETTINGS: ParentSettings = {
  pin: '',
  hasSetupPin: false,
  quietHours: {
    enabled: false,
    startTime: '21:00',
    endTime: '07:00',
  },
  recordingLimit: 5,
  recordingCountToday: 0,
  recordingCountDate: '',
  effects: {
    pitch: 0,   // -6 to +6 semitones
    speed: 1.0,
    reverb: false,
  },
  profiles: [
    {
      id: 'default',
      name: 'Kid',
      avatar: '🐷',
      recordingsCount: 0,
      createdAt: Date.now(),
    },
  ],
  activeProfileId: 'default',
  shareCode: '',
};
