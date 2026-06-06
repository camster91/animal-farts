// Parent dashboard — main route component
import { useState, useRef } from 'react';
import { useParentStore } from './store';
import PinGate, { type PinGateHandle } from './PinGate';
import QuietHoursCard from './QuietHoursCard';
import RecordingLimitCard from './RecordingLimitCard';
import EffectsCard from './EffectsCard';
import ProfilesCard from './ProfilesCard';
import PremiumCard from './PremiumCard';
import TvModeCard from './TvModeCard';
import ShareCodeCard from './ShareCodeCard';
import ImportCodeCard from './ImportCodeCard';
import UploadSoundCard from './UploadSoundCard';

type View = 'dashboard' | 'changepin';

export default function ParentApp() {
  const {
    settings,
    setPin,
    changePin,
    setQuietHours,
    setRecordingLimit,
    resetRecordingCount,
    setEffects,
    addProfile,
    updateProfile,
    deleteProfile,
    regenerateShareCode,
    copyShareCode,
    setTvModeEnabled,
  } = useParentStore();

  const [view, setView] = useState<View>('dashboard');
  const [unlocked, setUnlocked] = useState(false);
  const pinGateRef = useRef<PinGateHandle>(null);

  // Check for import code in URL
  const params = new URLSearchParams(window.location.search);
  const importCode = params.get('import');

  // Handle import code route
  if (importCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 px-4">
        <div className="text-center max-w-xs">
          <div className="text-5xl mb-3">🔗</div>
          <h1 className="text-2xl font-bold text-amber-900 mb-2">Import profile</h1>
          <p className="text-amber-700 text-sm">
            Profile import from code{' '}
            <span className="font-mono bg-amber-200 px-2 py-0.5 rounded">{importCode}</span>{' '}
            is not yet implemented. This feature is planned for v27.
          </p>
          <a
            href="/"
            className="mt-6 inline-block bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Go to Poot Party
          </a>
        </div>
      </div>
    );
  }

  // First time: PIN setup
  if (!settings.hasSetupPin) {
    return (
      <PinGate
        ref={pinGateRef}
        mode="setup"
        onSubmit={(pin) => {
          if (pin.length !== 4) {
            pinGateRef.current?.triggerShake('PIN must be 4 digits');
            return;
          }
          setPin(pin);
        }}
      />
    );
  }

  // Not yet unlocked: show PIN entry
  if (!unlocked) {
    return (
      <PinGate
        ref={pinGateRef}
        mode="enter"
        onSubmit={(pin) => {
          if (pin === settings.pin) {
            setUnlocked(true);
          } else {
            pinGateRef.current?.triggerShake('Wrong PIN — try again');
          }
        }}
      />
    );
  }

  // Change PIN sub-view
  if (view === 'changepin') {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col">
        <header className="bg-white border-b border-amber-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="text-amber-700 hover:text-amber-900 text-sm font-medium"
          >
            ← Back
          </button>
          <h1 className="font-bold text-amber-900">Change PIN</h1>
        </header>
        <div className="flex-1 flex items-center justify-center px-4">
          <PinGate
            ref={pinGateRef}
            mode="change"
            onSubmit={(newPin) => {
              if (newPin.length !== 4) {
                pinGateRef.current?.triggerShake('PIN must be 4 digits');
                return;
              }
              changePin(newPin);
              setView('dashboard');
            }}
            onCancel={() => setView('dashboard')}
          />
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-amber-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💨</span>
          <div>
            <h1 className="font-bold text-amber-900 leading-none">Poot Party</h1>
            <p className="text-xs text-amber-600">Operator dashboard</p>
          </div>
        </div>
        <button
          onClick={() => setView('changepin')}
          className="text-amber-700 hover:text-amber-900 text-sm font-medium flex items-center gap-1"
        >
          🔐 Change PIN
        </button>
      </header>

      {/* Cards */}
      <main className="max-w-md mx-auto px-3 py-4 space-y-3">
        <QuietHoursCard
          quietHours={settings.quietHours}
          onChange={setQuietHours}
        />
        <RecordingLimitCard
          recordingLimit={settings.recordingLimit}
          recordingCountToday={settings.recordingCountToday}
          onChangeLimit={setRecordingLimit}
          onReset={resetRecordingCount}
        />
        <EffectsCard
          effects={settings.effects}
          onChange={setEffects}
        />
        <ProfilesCard
          profiles={settings.profiles}
          activeProfileId={settings.activeProfileId}
          onAdd={addProfile}
          onUpdate={updateProfile}
          onDelete={deleteProfile}
        />
        <ShareCodeCard
          shareCode={settings.shareCode}
          onRegenerate={regenerateShareCode}
          onCopy={copyShareCode}
        />
        <PremiumCard
          isPremium={settings.isPremium}
        />
        <TvModeCard
          tvModeEnabled={settings.tvModeEnabled}
          onChange={setTvModeEnabled}
        />
        <ImportCodeCard
          activeProfileId={settings.activeProfileId}
        />
        <UploadSoundCard
          activeProfileId={settings.activeProfileId}
        />
      </main>
    </div>
  );
}
