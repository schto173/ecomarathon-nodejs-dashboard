import { useRaceStore } from '../store/raceStore'

function fmt(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

function diffColor(val) {
  if (val == null) return 'text-gray-400'
  return val > 0 ? 'text-red-400' : 'text-green-400'
}

export default function LapStats() {
  const { lapHistory, idealLapTime, currentLap, totalLaps } = useRaceStore()

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Lap History</h2>
        <span className="text-shell-yellow font-bold text-lg">
          {currentLap} <span className="text-gray-500 text-sm font-normal">/ {totalLaps}</span>
        </span>
      </div>

      {lapHistory.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">Waiting for lap data…</p>
      ) : (
        <div className="overflow-auto max-h-64">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left pb-2 pr-2">Lap</th>
                <th className="text-right pb-2 pr-2">Time</th>
                <th className="text-right pb-2 pr-2">Δ</th>
                <th className="text-right pb-2 pr-2">ml</th>
                <th className="text-right pb-2">km/l</th>
              </tr>
            </thead>
            <tbody>
              {[...lapHistory].reverse().map((lap, i) => {
                const kmPerL = lap.fuel_lap > 0
                  ? ((1.3196 / (lap.fuel_lap / 1000 / 0.745))).toFixed(0)
                  : '—'
                const diff = lap.lap_ideal_diff ?? (idealLapTime && lap.duration != null ? lap.duration - idealLapTime : null)
                return (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-2 font-medium text-white">{lap.lap}</td>
                    <td className="py-1.5 pr-2 text-right font-mono text-xs">{fmt(lap.duration)}</td>
                    <td className={`py-1.5 pr-2 text-right font-mono text-xs ${diffColor(diff)}`}>
                      {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(0)}s` : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-xs">{lap.fuel_lap ? lap.fuel_lap.toFixed(0) : '—'}</td>
                    <td className="py-1.5 text-right font-mono text-xs text-cyan-400">{kmPerL}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
