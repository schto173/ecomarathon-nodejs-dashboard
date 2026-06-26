import { useRef } from 'react'
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
  const { lapHistory, idealLapTime, currentLap, totalLaps, setLapHistory, clearLaps } = useRaceStore()
  const importRef = useRef(null)

  function handleReset() {
    fetch('/api/session/reset', { method: 'POST' }).catch(() => {})
    clearLaps()
  }

  function handleExport() {
    fetch('/api/session/export')
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `race-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { laps } = JSON.parse(ev.target.result)
        if (!Array.isArray(laps)) return
        fetch('/api/session/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ laps }),
        }).catch(() => {})
        clearLaps()
        setLapHistory(laps)
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Laps</h2>

        <div className="flex items-center gap-1 ml-auto">
          {/* Import */}
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title="Import race JSON"
          >↑ Import</button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={lapHistory.length === 0}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30"
            title="Export race JSON"
          >↓ Export</button>

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={lapHistory.length === 0}
            className="text-xs px-2 py-0.5 rounded border border-red-900 text-red-500 hover:text-red-300 hover:border-red-700 transition-colors disabled:opacity-30"
            title="Reset session"
          >Reset</button>
        </div>

        <span className="text-shell-yellow font-bold text-lg shrink-0">
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
              {[...lapHistory].reverse().map((lap) => {
                // projection is km/l computed by Node-RED (distance_m / fuel_lap_ml)
                const kmPerL = lap.projection != null && lap.projection > 0
                  ? lap.projection.toFixed(1)
                  : '—'
                const diff = lap.lap_ideal_diff ?? (idealLapTime && lap.duration ? lap.duration - idealLapTime : null)
                const avgKmh = lap.speed > 0 ? lap.speed.toFixed(1) : '—'
                const fuelMl = lap.fuel_lap != null ? lap.fuel_lap.toFixed(1) : '—'
                return (
                  <tr key={lap.lap} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-1 pr-1 font-medium text-white">{lap.lap}</td>
                    <td className="py-1 pr-1 text-right font-mono">{fmt(lap.duration)}</td>
                    <td className={`py-1 pr-1 text-right font-mono ${diffColor(diff)}`}>{fmtDiff(diff)}</td>
                    <td className="py-1 pr-1 text-right font-mono text-yellow-400">{avgKmh}</td>
                    <td className="py-1 pr-1 text-right font-mono">{fuelMl}</td>
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
