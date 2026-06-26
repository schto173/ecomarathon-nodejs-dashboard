import { useRef } from 'react'
import { useRaceStore } from '../store/raceStore'

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
  const {
    lapHistory, idealLapTime, currentLap, totalLaps,
    setLapHistory, clearLaps,
    selectedLap, setSelectedLap, clearSelectedLap,
  } = useRaceStore()
  const importRef = useRef(null)

  // Best lap by fuel efficiency (highest projection = km/L)
  const bestEffIdx = lapHistory.reduce((best, l, i) => {
    if (l.projection > 0 && (best === -1 || l.projection > lapHistory[best].projection)) return i
    return best
  }, -1)

  function handleReset() {
    fetch('/api/session/reset', { method: 'POST' }).catch(() => {})
    clearLaps()
    clearSelectedLap()
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
        clearSelectedLap()
        setLapHistory(laps)
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Laps</h2>

        {/* Replay mode banner */}
        {selectedLap && (
          <button
            onClick={clearSelectedLap}
            className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-shell-yellow/20 text-shell-yellow border border-shell-yellow/40 hover:bg-shell-yellow/30 transition-colors font-semibold"
          >
            ← Live
          </button>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title="Import race JSON"
          >↑ Import</button>
          <button
            onClick={handleExport}
            disabled={lapHistory.length === 0}
            className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30"
            title="Export race JSON (includes GPS trails)"
          >↓ Export</button>
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

      {selectedLap && (
        <div className="text-xs text-gray-500 bg-gray-800/60 rounded-lg px-2.5 py-1.5">
          Viewing lap <span className="text-shell-yellow font-bold">#{selectedLap.lap}</span> on map
          — trail and engine events shown for that lap only
        </div>
      )}

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
              {[...lapHistory].reverse().map((lap, ri) => {
                const origIdx = lapHistory.length - 1 - ri
                const isBest = origIdx === bestEffIdx
                const isSelected = selectedLap?.lap === lap.lap
                const kmPerL = lap.projection > 0 ? lap.projection.toFixed(1) : '—'
                const diff = lap.lap_ideal_diff ?? (idealLapTime && lap.duration ? lap.duration - idealLapTime : null)
                const avgKmh = lap.speed > 0 ? lap.speed.toFixed(1) : '—'
                const fuelMl = lap.fuel_lap != null ? lap.fuel_lap.toFixed(1) : '—'
                const hasTrail = Array.isArray(lap.trail) && lap.trail.length > 0

                return (
                  <tr
                    key={lap.lap}
                    onClick={() => isSelected ? clearSelectedLap() : setSelectedLap(lap)}
                    className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-shell-yellow/10 border-shell-yellow/20'
                        : 'hover:bg-gray-800/40'
                    }`}
                  >
                    <td className="py-1 pr-1 font-medium">
                      <span className={isSelected ? 'text-shell-yellow' : 'text-white'}>{lap.lap}</span>
                      {isBest && <span className="ml-1 text-yellow-400" title="Best fuel efficiency">🏆</span>}
                      {hasTrail && !isSelected && <span className="ml-1 text-gray-600" title="Trail available">·</span>}
                    </td>
                    <td className="py-1 pr-1 text-right font-mono text-white">{fmt(lap.duration)}</td>
                    <td className={`py-1 pr-1 text-right font-mono ${diffColor(diff)}`}>{fmtDiff(diff)}</td>
                    <td className="py-1 pr-1 text-right font-mono text-yellow-400">{avgKmh}</td>
                    <td className="py-1 pr-1 text-right font-mono">{fuelMl}</td>
                    <td className={`py-1 text-right font-mono ${isBest ? 'text-yellow-400 font-bold' : 'text-cyan-400'}`}>{kmPerL}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-gray-700 text-xs mt-1.5 text-center">Tap a lap to view its trail on the map</p>
        </div>
      )}
    </div>
  )
}
