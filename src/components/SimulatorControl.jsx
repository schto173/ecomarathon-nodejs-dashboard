import { useState, useEffect } from 'react'
import { Play, Square, Pause, RotateCcw } from 'lucide-react'
import { useRaceStore } from '../store/raceStore'

export default function SimulatorControl() {
  const [status, setStatus] = useState({ state: 'stopped', progress: 0, virtualMs: 0 })
  const clearLaps = useRaceStore((s) => s.clearLaps)

  useEffect(() => {
    const poll = () =>
      fetch('/api/sim/status').then(r => r.json()).then(setStatus).catch(() => {})
    poll()
    const id = setInterval(poll, 500)
    return () => clearInterval(id)
  }, [])

  const cmd = (path) =>
    fetch(path, { method: 'POST' }).then(r => r.json()).then(setStatus).catch(() => {})

  const running = status.state === 'playing'
  const paused  = status.state === 'paused'
  const pct     = Math.round((status.progress ?? 0) * 100)
  const elapsed = Math.round((status.virtualMs ?? 0) / 1000)
  const min     = Math.floor(elapsed / 60)
  const sec     = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="bg-gray-900 border border-shell-yellow/40 rounded-xl p-2.5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : paused ? 'bg-yellow-400' : 'bg-gray-600'}`} />
          <span className="text-xs font-bold text-shell-yellow uppercase tracking-wider">Simulator</span>
        </div>
        <div className="ml-auto text-xs text-gray-500 font-mono">
          {min}:{sec} · {pct}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-shell-yellow transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { clearLaps(); cmd('/api/sim/stop') }}
          title="Stop & reset"
          className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <RotateCcw size={13} />
        </button>

        <div className="flex gap-1 ml-auto">
          {running ? (
            <>
              <button
                onClick={() => cmd('/api/sim/pause')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-900/60 text-yellow-400 hover:bg-yellow-800 text-xs font-bold transition-colors"
              >
                <Pause size={11} /> Pause
              </button>
              <button
                onClick={() => cmd('/api/sim/stop')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/60 text-red-400 hover:bg-red-800 text-xs font-bold transition-colors"
              >
                <Square size={11} /> Stop
              </button>
            </>
          ) : (
            <button
              onClick={() => cmd('/api/sim/play')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-900/60 text-green-400 hover:bg-green-800 text-xs font-bold transition-colors"
            >
              <Play size={11} /> {paused ? 'Resume' : 'Start'}
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-600 leading-snug">
        Publishes via MQTT · <span className="font-mono text-gray-500">gps/position · ecu/data · speed/data</span>
      </div>
    </div>
  )
}
