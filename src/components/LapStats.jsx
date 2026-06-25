import { useRaceStore } from '../store/raceStore'

const LAP_KM = 1.3196

function fmt(seconds) {
  if (seconds == null || seconds === 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

function diffColor(val) {
  if (val == null) return 'text-gray-400'
  return val > 0 ? 'text-red-400' : 'text-green-400'
}

function fmtDiff(val) {
  if (val == null) return '—'
  return `${val > 0 ? '+' : ''}${val.toFixed(0)}s`
}

export default function LapStats() {
  const { lapHistory, idealLapTime, currentLap, totalLaps } = useRaceStore()

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Laps</h2>
        <span className="text-shell-yellow font-bold text-lg">
          {currentLap} <span className="text-gray-500 text-sm font-normal">/ {totalLaps}</span>
        </span>
      </div>

      {lapHistory.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">No lap data yet…</p>
      ) : (
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase border-b border-gray-800 sticky top-0 bg-gray-900">
                <th className="text-left pb-1.5 pr-1">#</th>
                <th className="text-right pb-1.5 pr-1">Time</th>
                <th className="text-right pb-1.5 pr-1">Δ</th>
                <th className="text-right pb-1.5 pr-1">km/h</th>
                <th className="text-right pb-1.5 pr-1">ml</th>
                <th className="text-right pb-1.5">km/l</th>
              </tr>
            </thead>
            <tbody>
              {[...lapHistory].reverse().map((lap, i) => {
                const kmPerL = lap.fuel_lap > 0
                  ? (LAP_KM / (lap.fuel_lap / 1000 / 0.745)).toFixed(0)
                  : '—'
                const diff = lap.lap_ideal_diff ?? (idealLapTime && lap.duration ? lap.duration - idealLapTime : null)
                const avgKmh = lap.speed > 0 ? lap.speed.toFixed(1) : '—'
                return (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-1 pr-1 font-medium text-white">{lap.lap}</td>
                    <td className="py-1 pr-1 text-right font-mono">{fmt(lap.duration)}</td>
                    <td className={`py-1 pr-1 text-right font-mono ${diffColor(diff)}`}>
                      {fmtDiff(diff)}
                    </td>
                    <td className="py-1 pr-1 text-right font-mono text-yellow-400">{avgKmh}</td>
                    <td className="py-1 pr-1 text-right font-mono">{lap.fuel_lap ? lap.fuel_lap.toFixed(0) : '—'}</td>
                    <td className="py-1 text-right font-mono text-cyan-400">{kmPerL}</td>
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
