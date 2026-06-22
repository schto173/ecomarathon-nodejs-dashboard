const SLOW_KMH = 18, FAST_KMH = 40, MAX_KMH = 45

function speedColor(kmh) {
  if (kmh == null || kmh < 1) return '#374151'
  if (kmh <= SLOW_KMH) return 'rgb(30,58,180)'
  if (kmh >= FAST_KMH) return 'rgb(221,29,33)'
  const t = (kmh - SLOW_KMH) / (FAST_KMH - SLOW_KMH)
  return `rgb(${Math.round(30+(221-30)*t)},${Math.round(58+(29-58)*t)},${Math.round(180+(33-180)*t)})`
}

// Polar → cartesian on a unit circle, angle in degrees from bottom-left (225°) going clockwise
const START_DEG = 225
const SWEEP_DEG = 270

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg)
  const [x2, y2] = polar(cx, cy, r, endDeg)
  const large = (endDeg - startDeg) > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export default function SpeedDial({ kmh, size = 120 }) {
  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.38
  const r2 = size * 0.30  // inner tick radius

  const color   = speedColor(kmh)
  const pct     = Math.min(1, Math.max(0, (kmh ?? 0) / MAX_KMH))
  const needleDeg = START_DEG + pct * SWEEP_DEG
  const arcEnd    = START_DEG + pct * SWEEP_DEG

  // Gradient arc — draw N segments for smooth look
  const SEGS = 40
  const arcSegments = Array.from({ length: SEGS }, (_, i) => {
    const t0 = i / SEGS
    const t1 = (i + 1) / SEGS
    const d0 = START_DEG + t0 * SWEEP_DEG
    const d1 = START_DEG + t1 * SWEEP_DEG
    return { d: arcPath(cx, cy, R, d0, d1), color: speedColor(t0 * MAX_KMH) }
  })

  // Tick marks
  const ticks = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9
    const deg = START_DEG + t * SWEEP_DEG
    const [ox, oy] = polar(cx, cy, R + size * 0.04, deg)
    const [ix, iy] = polar(cx, cy, R - size * 0.02, deg)
    const tickKmh = t * MAX_KMH
    return { ox, oy, ix, iy, color: speedColor(tickKmh), major: i % 3 === 0 }
  })

  // Needle tip
  const [nx, ny] = polar(cx, cy, R - size * 0.04, needleDeg)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background arc (full sweep, dark) */}
        <path d={arcPath(cx, cy, R, START_DEG, START_DEG + SWEEP_DEG)}
          fill="none" stroke="#1f2937" strokeWidth={size * 0.06} strokeLinecap="round" />

        {/* Colored gradient arc segments (up to current speed) */}
        {arcSegments.map((seg, i) => {
          const segT = (i + 1) / SEGS
          if (segT > pct + 1 / SEGS) return null
          const opacity = segT <= pct ? 1 : (pct - (i / SEGS)) * SEGS
          return (
            <path key={i} d={seg.d} fill="none" stroke={seg.color}
              strokeWidth={size * 0.055} strokeLinecap="butt" opacity={Math.max(0, Math.min(1, opacity))} />
          )
        })}

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.ox} y1={t.oy} x2={t.ix} y2={t.iy}
            stroke={t.color} strokeWidth={t.major ? 1.5 : 0.8} opacity={0.7} />
        ))}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={color} strokeWidth={size * 0.025} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx={cx} cy={cy} r={size * 0.04} fill="#111827" stroke={color} strokeWidth={1.5} />
      </svg>

      {/* Digital readout */}
      <div className="font-mono font-bold leading-none -mt-3" style={{ color, fontSize: size * 0.22 }}>
        {kmh != null ? kmh.toFixed(1) : '—'}
        <span className="text-gray-500 font-normal ml-1" style={{ fontSize: size * 0.10 }}>km/h</span>
      </div>
    </div>
  )
}
