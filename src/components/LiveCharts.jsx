import { useRaceStore } from '../store/raceStore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-1.5 text-xs">
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</b>
        </div>
      ))}
    </div>
  )
}

export default function LiveCharts() {
  const { positionHistory, ecuHistory } = useRaceStore()

  // Use positionHistory for speed — always has real GPS/physics speed, not RPM-derived
  const speedData = positionHistory.slice(-80).map((d, i) => ({
    i,
    'km/h': d.speed_kmh != null ? +d.speed_kmh.toFixed(1) : null,
  }))

  const fuelData = ecuHistory.slice(-80).map((d, i) => ({
    i,
    'g/min': d.FuelConsumption_g_min != null ? +d.FuelConsumption_g_min.toFixed(2) : null,
    'ECT °C': d.ECT ?? null,
  }))

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Speed</div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="i" hide />
              <YAxis domain={[0, 50]} tick={{ fill: '#6b7280', fontSize: 9 }} />
              <Tooltip content={<TT />} />
              <Line type="monotone" dataKey="km/h" name="km/h" stroke="#FBCE07" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fuel rate &amp; ECT</div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fuelData} margin={{ top: 2, right: 28, left: -24, bottom: 0 }}>
              <XAxis dataKey="i" hide />
              <YAxis yAxisId="l" tick={{ fill: '#6b7280', fontSize: 9 }} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 120]} tick={{ fill: '#6b7280', fontSize: 9 }} />
              <Tooltip content={<TT />} />
              <Line yAxisId="l" type="monotone" dataKey="g/min" name="g/min" stroke="#f97316" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
              <Line yAxisId="r" type="monotone" dataKey="ECT °C" name="ECT °C" stroke="#FBCE07" dot={false} strokeWidth={1.5} isAnimationActive={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
