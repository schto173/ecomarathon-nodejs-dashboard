import { useRaceStore } from '../store/raceStore'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

const LAP_KM = 1.3196

function fmtLap(s) {
  if (s == null) return '—'
  return `${Math.floor(Math.abs(s) / 60)}:${(Math.abs(s) % 60).toFixed(1).padStart(4, '0')}`
}

export default function StrategyPanel() {
  const { getStrategyStats, idealLapTime } = useRaceStore()
  const { remainingLaps, avgLapTime, avgFuelPerLap, projectedTotalFuel, paceDelta } = getStrategyStats()
  const paceOk = paceDelta != null && paceDelta <= 0

  const kmPerL = avgFuelPerLap != null && avgFuelPerLap > 0
    ? (LAP_KM / (avgFuelPerLap / 1000 / 0.745)).toFixed(0)
    : null

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Strategy</div>

      {/* Pace row */}
      <div className="flex items-center justify-between bg-gray-800 rounded-lg px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {paceOk ? <TrendingDown size={13} className="text-green-400" /> : <TrendingUp size={13} className="text-red-400" />}
          Pace vs ideal
        </div>
        <span className={`font-mono text-base font-bold ${paceOk ? 'text-green-400' : 'text-red-400'}`}>
          {paceDelta != null ? `${paceDelta > 0 ? '+' : ''}${paceDelta.toFixed(1)}s` : '—'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-500 mb-0.5">Avg lap</div>
          <div className="font-mono font-bold text-white text-sm">{fmtLap(avgLapTime)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-500 mb-0.5">Ideal lap</div>
          <div className="font-mono font-bold text-shell-yellow text-sm">{fmtLap(idealLapTime)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-500 mb-0.5">Fuel / lap</div>
          <div className="font-mono font-bold text-white text-sm">{avgFuelPerLap != null ? `${avgFuelPerLap.toFixed(1)} ml` : '—'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-gray-500 mb-0.5">km / l</div>
          <div className="font-mono font-bold text-cyan-400 text-sm">{kmPerL ?? '—'}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2 col-span-2">
          <div className="text-gray-500 mb-0.5">Proj. finish</div>
          <div className={`font-mono font-bold text-sm ${projectedTotalFuel != null && projectedTotalFuel > 100 ? 'text-red-400' : 'text-white'}`}>
            {projectedTotalFuel != null ? `${projectedTotalFuel.toFixed(0)} ml` : '—'}
            {kmPerL && <span className="text-gray-500 font-normal ml-2 text-xs">· {kmPerL} km/l</span>}
          </div>
        </div>
      </div>

      {/* Remaining laps */}
      <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs ${remainingLaps <= 3 ? 'bg-red-900/40 text-red-300' : 'bg-gray-800 text-gray-300'}`}>
        {remainingLaps <= 3
          ? <AlertTriangle size={12} className="text-red-400 shrink-0" />
          : <CheckCircle size={12} className="text-green-400 shrink-0" />}
        <span><b className="text-white text-sm">{remainingLaps}</b> laps remaining</span>
      </div>
    </div>
  )
}
