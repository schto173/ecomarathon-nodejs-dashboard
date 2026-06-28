import { useRaceStore } from '../store/raceStore'
import { Fuel, TrendingDown } from 'lucide-react'
import { useFuelFactor } from '../hooks/useFuelFactor'

const FUEL_LIMIT_ML = 133  // Shell Eco-marathon gasoline limit (ml equivalent)

function LinearBar({ value, max, color, label, unit, decimals = 0 }) {
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100))
  const near = pct > 75
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className={`font-mono font-semibold ${near ? 'text-red-400' : 'text-white'}`}>
          {value != null ? `${value.toFixed(decimals)} ${unit}` : '—'}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: near ? '#DD1D21' : color }}
        />
      </div>
    </div>
  )
}

export default function FuelGauge() {
  const { ecuData, lapHistory, getStrategyStats } = useRaceStore()
  const { projectedTotalFuel, avgFuelPerLap, remainingLaps } = getStrategyStats()
  const [factor] = useFuelFactor()

  const fuelMl = ecuData?.FuelTotal_ml != null ? ecuData.FuelTotal_ml * factor : null
  const adjProjected = projectedTotalFuel != null ? projectedTotalFuel * factor : null
  const adjAvgFuel = avgFuelPerLap != null ? avgFuelPerLap * factor : null
  const rate = ecuData?.FuelConsumption_g_min ?? null

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Fuel size={14} className="text-shell-yellow" />
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fuel</h2>
        {fuelMl != null && fuelMl > FUEL_LIMIT_ML * 0.9 && (  // fuelMl already has factor applied
          <span className="ml-auto text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-medium">
            LIMIT WARNING
          </span>
        )}
      </div>

      <LinearBar
        value={fuelMl}
        max={FUEL_LIMIT_ML}
        color="#FBCE07"
        label="Total used"
        unit="ml"
        decimals={1}
      />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
            <TrendingDown size={10} /> Live rate
          </div>
          <div className="font-mono font-bold text-orange-400">
            {rate != null ? rate.toFixed(2) : '—'}
            <span className="text-xs font-normal text-gray-400 ml-1">g/min</span>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Per lap avg</div>
          <div className="font-mono font-bold text-white">
            {adjAvgFuel != null ? adjAvgFuel.toFixed(1) : '—'}
            <span className="text-xs font-normal text-gray-400 ml-1">ml</span>
          </div>
        </div>
      </div>

      {adjProjected != null && (
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
          adjProjected > FUEL_LIMIT_ML ? 'bg-red-900/40 text-red-300' : 'bg-green-900/30 text-green-300'
        }`}>
          <span className="text-xs">Projected finish</span>
          <span className="font-mono font-bold">{adjProjected.toFixed(0)} ml / {FUEL_LIMIT_ML} ml</span>
        </div>
      )}
    </div>
  )
}
