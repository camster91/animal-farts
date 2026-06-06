// Card 2: Daily recording limit
interface Props {
  recordingLimit: number;
  recordingCountToday: number;
  onChangeLimit: (n: number) => void;
  onReset: () => void;
}

export default function RecordingLimitCard({
  recordingLimit,
  recordingCountToday,
  onChangeLimit,
  onReset,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🎙️</span>
        <div>
          <h2 className="font-bold text-amber-900">Daily recording limit</h2>
          <p className="text-xs text-amber-600">Control how many sounds per day</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex-1">
          <span className="text-xs text-amber-600 block mb-1">Max recordings / day</span>
          <input
            type="number"
            min={1}
            max={20}
            value={recordingLimit}
            onChange={(e) => onChangeLimit(parseInt(e.target.value) || 1)}
            className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-center font-bold text-amber-900 text-xl focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
        <div className="text-center">
          <p className="text-xs text-amber-600 mb-1">Today</p>
          <p className="text-2xl font-bold text-amber-700">
            {recordingCountToday}
            <span className="text-base text-amber-400">/{recordingLimit}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={onReset}
          className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium text-sm py-2 rounded-xl transition-colors"
        >
          🔄 Reset now
        </button>
      </div>

      <p className="text-xs text-amber-500 mt-3">
        The kid can record up to {recordingLimit} sounds per day
      </p>
    </div>
  );
}
