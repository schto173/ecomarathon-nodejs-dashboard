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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-gray-500 animate-pulse' : 'bg-gray-700'}`} />
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Simulator</span>
        </div>
        <div className="ml-auto text-xs text-gray-700 font-mono">
          {min}:{sec} · {pct}%
        </div>
      </div>

      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-600 transition-all duration-300 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { clearLaps(); cmd('/api/sim/stop') }}
          title="Stop & reset"
          className="p-1.5 rounded-lg bg-gray-800 text-gray-600 hover:text-gray-400 transition-colors"
        >
          <RotateCcw size={13} />
        </button>

        <div className="flex gap-1 ml-auto">
          {running ? (
            <>
              <button
                onClick={() => cmd('/api/sim/pause')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 text-xs font-bold transition-colors"
              >
                <Pause size={11} /> Pause
              </button>
              <button
                onClick={() => cmd('/api/sim/stop')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 text-xs font-bold transition-colors"
              >
                <Square size={11} /> Stop
              </button>
            </>
          ) : (
            <button
              onClick={() => cmd('/api/sim/play')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 text-xs font-bold transition-colors"
            >
              <Play size={11} /> {paused ? 'Resume' : 'Start'}
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-700 leading-snug">
        Publishes via MQTT · <span className="font-mono">gps/position · ecu/data · speed/data</span>
      </div>
    </div>
  )
}
