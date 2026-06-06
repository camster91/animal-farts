// Card: TV Mode toggle — enable/disable Poot Party TV for the kid app

interface Props {
  tvModeEnabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function TvModeCard({ tvModeEnabled, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📺</span>
        <div>
          <h2 className="font-bold text-amber-900">Poot Party TV</h2>
          <p className="text-xs text-amber-600">Auto-play mode for children</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-amber-700 flex-1 mr-4">
          Full-screen scene cycling with sounds. Tap anywhere to exit.
        </p>
        <button
          onClick={() => onChange(!tvModeEnabled)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 ${
            tvModeEnabled ? 'bg-amber-500' : 'bg-amber-200'
          }`}
          role="switch"
          aria-checked={tvModeEnabled}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              tvModeEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
