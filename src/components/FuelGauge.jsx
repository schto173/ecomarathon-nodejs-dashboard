import { useRaceStore } from '../store/raceStore'
import { Fuel } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function FuelGauge() {
  const { ecuData, lapHistory } = useRaceStore()

  const fuelMl = ecuData?.FuelTotal_ml ?? null
  const rate = ecuData?.FuelConsumption_g_min ?? null

  const fuelChartData = lapHistory.map((l) => ({
    lap: `L${l.lap}`,
    fuel: l.fuel_lap ? +l.fuel_lap.toFixed(1) : 0,
    total: l.fuel_race ? +l.fuel_race.toFixed(1) : 0,
  }))

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Fuel size={16} className="text-shell-yellow" />
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Fuel</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Total Used</div>
          <div className="text-2xl font-bold text-shell-yellow">
            {fuelMl != null ? `${fuelMl.toFixed(0)}` : '—'}
            <span className="text-sm font-normal text-gray-400 ml-1">ml</span>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Rate</div>
          <div className="text-2xl font-bold text-white">
            {rate != null ? `${rate.toFixed(2)}` : '—'}
            <span className="text-sm font-normal text-gray-400 ml-1">g/min</span>
          </div>
        </div>
      </div>

      {fuelChartData.length > 0 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fuelChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FBCE07" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FBCE07" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="lap" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                itemStyle={{ color: '#FBCE07' }}
              />
              <Area
                type="monotone"
                dataKey="fuel"
                stroke="#FBCE07"
                fill="url(#fuelGrad)"
                strokeWidth={2}
                name="Fuel/lap (ml)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
