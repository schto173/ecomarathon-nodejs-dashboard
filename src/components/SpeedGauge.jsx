import { useRaceStore } from '../store/raceStore'

const MAX_SPEED = 45
const MAX_RPM = 8000

function ArcGauge({ value, max, label, unit, color, size = 160 }) {
  const pct = Math.min(1, Math.max(0, (value ?? 0) / max))
  const r = size / 2 - 14
  const cx = size / 2
  const cy = size / 2
  const startAngle = -220
  const sweepAngle = 260
  const toRad = (d) => (d * Math.PI) / 180
  const arc = (angle) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  })
  const endAngle = startAngle + sweepAngle * pct
  const largeArc = sweepAngle * pct > 180 ? 1 : 0
  const s = arc(startAngle)
  const e = arc(endAngle)
  const bg1 = arc(startAngle)
  const bg2 = arc(startAngle + sweepAngle)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <path
          d={`M ${bg1.x} ${bg1.y} A ${r} ${r} 0 1 1 ${bg2.x} ${bg2.y}`}
          fill="none"
          stroke="#1f2937"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {pct > 0 && (
          <path
            d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
          />
        )}
        {/* Center value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={size * 0.2} fontWeight="bold" fontFamily="monospace">
          {value != null ? (value < 10 ? value.toFixed(1) : Math.round(value)) : '—'}
        </text>
        <text x={cx} y={cy + size * 0.14} textAnchor="middle" fill="#6b7280" fontSize={size * 0.09} fontFamily="sans-serif">
          {unit}
        </text>
      </svg>
      <span className="text-xs text-gray-500 uppercase tracking-widest -mt-2">{label}</span>
    </div>
  )
}

export default function SpeedGauge() {
  const { speedData, position } = useRaceStore()
  const rpm = speedData?.rpm ?? null
  const speed = rpm != null ? rpm * 0.0894 : (position?.speed_kmh ?? null)

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="grid grid-cols-2 gap-0 items-center">
        <ArcGauge value={speed} max={MAX_SPEED} label="Speed" unit="km/h" color="#FBCE07" size={130} />
        <ArcGauge value={rpm} max={MAX_RPM} label="RPM" unit="rpm" color="#DD1D21" size={110} />
      </div>
    </div>
  )
}
