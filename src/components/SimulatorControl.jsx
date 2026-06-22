import { useSimulator } from '../simulator/useSimulator'
import { useRaceStore } from '../store/raceStore'
import { Play, Square, RotateCcw } from 'lucide-react'
import { WAYPOINTS } from '../simulator/lapData'

const SPEED_LABELS = { slow: '0.5×', normal: '1×', fast: '2×' }

export default function SimulatorControl() {
  const { running, speed, setSpeed, stats, start, stop, reset } = useSimulator()
  const clearLaps = useRaceStore((s) => s.clearLaps)

  const progress = WAYPOINTS.length ? (stats.idx / WAYPOINTS.length) * 100 : 0

  return (
    <div className="bg-gray-900 border border-shell-yellow/40 rounded-xl p-2.5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-xs font-bold text-shell-yellow uppercase tracking-wider">Simulator</span>
        </div>
        <div className="ml-auto text-xs text-gray-500 font-mono">
          Lap {stats.lap} · {stats.dist}m
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-shell-yellow transition-all duration-200 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        {/* Speed selector */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
          {Object.entries(SPEED_LABELS).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setSpeed(k); if (running) { stop(); setTimeout(() => start(k), 50) } }}
              className={`px-2 py-1 font-mono transition-colors ${speed === k ? 'bg-shell-yellow text-gray-950 font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => { clearLaps(); reset() }}
            title="Reset"
            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          {running ? (
            <button
              onClick={stop}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/60 text-red-400 hover:bg-red-800 text-xs font-bold transition-colors"
            >
              <Square size={11} /> Stop
            </button>
          ) : (
            <button
              onClick={() => start(speed)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-900/60 text-green-400 hover:bg-green-800 text-xs font-bold transition-colors"
            >
              <Play size={11} /> Start
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
