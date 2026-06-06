// Card 1: Quiet hours — toggle + time range
import type { ParentSettings } from './types';

interface Props {
  quietHours: ParentSettings['quietHours'];
  onChange: (qh: ParentSettings['quietHours']) => void;
}

export default function QuietHoursCard({ quietHours, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
<div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌙</span>
          <div>
            <h2 className="font-bold text-amber-900">Quiet hours</h2>
            <p className="text-xs text-amber-600">Mute sound during set hours</p>
          </div>
        </div>
        <button
          onClick={() => onChange({ ...quietHours, enabled: !quietHours.enabled })}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            quietHours.enabled ? 'bg-amber-500' : 'bg-amber-200'
          }`}
          aria-label={quietHours.enabled ? 'Disable quiet hours' : 'Enable quiet hours'}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              quietHours.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {quietHours.enabled && (
        <div className="flex gap-4 mt-3">
          <label className="flex-1">
            <span className="text-xs text-amber-600 block mb-1">Start</span>
            <input
              type="time"
              value={quietHours.startTime}
              onChange={(e) => onChange({ ...quietHours, startTime: e.target.value })}
              className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-center font-medium text-amber-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-amber-600 block mb-1">End</span>
            <input
              type="time"
              value={quietHours.endTime}
              onChange={(e) => onChange({ ...quietHours, endTime: e.target.value })}
              className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-center font-medium text-amber-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </label>
        </div>
      )}

      <p className="text-xs text-amber-500 mt-3">
        🌙 During quiet hours, the app shows a moon and the sound is muted
      </p>
    </div>
  );
}
