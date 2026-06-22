import { useRaceStore } from '../store/raceStore'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

function fmt(seconds) {
  if (seconds == null) return '—'
  const m = Math.floor(Math.abs(seconds) / 60)
  const s = Math.abs(seconds % 60).toFixed(1)
  return `${seconds < 0 ? '-' : '+'}${m}:${s.padStart(4, '0')}`
}

export default function StrategyPanel() {
  const { getStrategyStats, position, idealLapTime } = useRaceStore()
  const { remainingLaps, avgLapTime, avgFuelPerLap, projectedTotalFuel, paceDelta } = getStrategyStats()

  const paceOk = paceDelta != null && paceDelta <= 0
  const PaceIcon = paceOk ? TrendingDown : TrendingUp

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Strategy</h2>

      {/* Speed */}
      {position?.speed_kmh != null && (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
          <span className="text-gray-400 text-sm">Current Speed</span>
          <span className="text-2xl font-bold text-white">
            {position.speed_kmh.toFixed(1)} <span className="text-sm font-normal text-gray-400">km/h</span>
          </span>
        </div>
      )}

      {/* Pace vs ideal */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <PaceIcon size={16} className={paceOk ? 'text-green-400' : 'text-red-400'} />
          Pace vs Ideal
        </div>
        <span className={`font-mono font-semibold ${paceOk ? 'text-green-400' : 'text-red-400'}`}>
          {paceDelta != null ? fmt(paceDelta) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Avg Lap Time</div>
          <div className="font-mono font-medium text-white">
            {avgLapTime != null
              ? `${Math.floor(avgLapTime / 60)}:${(avgLapTime % 60).toFixed(1).padStart(4, '0')}`
              : '—'}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Ideal Lap</div>
          <div className="font-mono font-medium text-shell-yellow">
            {idealLapTime != null
              ? `${Math.floor(idealLapTime / 60)}:${(idealLapTime % 60).toFixed(1).padStart(4, '0')}`
              : '—'}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Fuel/Lap avg</div>
          <div className="font-mono font-medium text-white">
            {avgFuelPerLap != null ? `${avgFuelPerLap.toFixed(1)} ml` : '—'}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Proj. Total</div>
          <div className="font-mono font-medium text-white">
            {projectedTotalFuel != null ? `${projectedTotalFuel.toFixed(0)} ml` : '—'}
          </div>
        </div>
      </div>

      {/* Remaining laps alert */}
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${remainingLaps <= 3 ? 'bg-red-900/40 text-red-300' : 'bg-gray-800 text-gray-300'}`}>
        {remainingLaps <= 3
          ? <AlertTriangle size={16} className="text-red-400 shrink-0" />
          : <CheckCircle size={16} className="text-green-400 shrink-0" />}
        <span>
          {remainingLaps > 0
            ? <><span className="font-bold text-white">{remainingLaps}</span> laps remaining</>
            : 'Race complete'}
        </span>
      </div>
    </div>
  )
}
