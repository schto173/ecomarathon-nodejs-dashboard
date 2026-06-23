import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useRaceStore } from '../store/raceStore'
import Draggable from './Draggable'
import SpeedDial from './SpeedDial'

const SILESIA_CENTER = [50.5293, 18.0960]
const DEFAULT_ZOOM = 17

const SPEED_STOPS = [
  { t: 0,    r: 30,  g: 58,  b: 180 },
  { t: 0.25, r: 6,   g: 182, b: 212 },
  { t: 0.5,  r: 52,  g: 211, b: 153 },
  { t: 0.75, r: 251, g: 191, b: 36  },
  { t: 1,    r: 220, g: 38,  b: 38  },
]
const SLOW_KMH = 18, FAST_KMH = 40

function speedColor(kmh) {
  if (kmh == null || kmh < 1) return '#374151'
  const t = Math.min(1, Math.max(0, (kmh - SLOW_KMH) / (FAST_KMH - SLOW_KMH)))
  let lo = SPEED_STOPS[0], hi = SPEED_STOPS[SPEED_STOPS.length - 1]
  for (let i = 0; i < SPEED_STOPS.length - 1; i++) {
    if (t >= SPEED_STOPS[i].t && t <= SPEED_STOPS[i + 1].t) { lo = SPEED_STOPS[i]; hi = SPEED_STOPS[i + 1]; break }
  }
  const f = lo.t === hi.t ? 0 : (t - lo.t) / (hi.t - lo.t)
  return `rgb(${Math.round(lo.r+(hi.r-lo.r)*f)},${Math.round(lo.g+(hi.g-lo.g)*f)},${Math.round(lo.b+(hi.b-lo.b)*f)})`
}

// Direct Leaflet layer management — bypasses react-leaflet reconciler to guarantee clean removal
function TrailLayer({ trail }) {
  const map = useMap()
  const layersRef = useRef([])

  useEffect(() => {
    layersRef.current.forEach(l => { try { map.removeLayer(l) } catch (_) {} })
    layersRef.current = []
    if (!trail.length) return

    const segments = []
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i]
      if (!a.latitude || !b.latitude) continue
      const color = b._color ?? speedColor(b.speed_kmh)
      const last = segments[segments.length - 1]
      if (last && last.color === color) {
        last.positions.push([b.latitude, b.longitude])
      } else {
        segments.push({ color, positions: [[a.latitude, a.longitude], [b.latitude, b.longitude]] })
      }
    }

    segments.forEach(seg => {
      const layer = L.polyline(seg.positions, { color: seg.color, weight: 4, opacity: 0.95 })
      layer.addTo(map)
      layersRef.current.push(layer)
    })

    return () => {
      layersRef.current.forEach(l => { try { map.removeLayer(l) } catch (_) {} })
      layersRef.current = []
    }
  }, [trail])

  return null
}

function makeIcon(html, w, h) {
  return L.divIcon({ className: '', html, iconAnchor: [w / 2, h / 2], iconSize: [w, h] })
}

function makeCarIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #000;border-radius:50%;box-shadow:0 0 6px #0008"></div>`,
    iconAnchor: [7, 7], iconSize: [14, 14],
  })
}

function engineEventIcon(ev) {
  const isStart = ev.type === 'start'
  const bg = isStart ? '#16a34a' : '#DD1D21'
  const symbol = isStart ? '▶' : '■'
  const speed = ev.speed_kmh?.toFixed(0) ?? '?'
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;
        background:${bg};border:2px solid #fff;border-radius:50%;font-size:9px;color:#fff;
        box-shadow:0 0 6px ${bg}99">${symbol}</div>
      <div style="background:${bg}dd;color:#fff;font-size:9px;font-weight:bold;padding:1px 4px;
        border-radius:3px;white-space:nowrap;line-height:1.3">${speed} km/h</div>
    </div>`,
    iconAnchor: [26, 8], iconSize: [52, 34],
  })
}

function cornerIcon() {
  return makeIcon(`<div style="width:8px;height:8px;background:#a78bfa;border:2px solid #fff;border-radius:50%"></div>`, 8, 8)
}

function InvalidateSize() {
  const map = useMap()
  useEffect(() => {
    // Force Leaflet to recalculate its container size after the flex layout resolves
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [])
  return null
}

function FitToTrail({ trail }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || trail.length < 60) return
    const lats = trail.map(p => p.latitude).filter(Boolean)
    const lngs = trail.map(p => p.longitude).filter(Boolean)
    if (!lats.length) return
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [48, 48], maxZoom: 18, animate: true, duration: 1.0 },
    )
    done.current = true
  }, [trail.length])
  return null
}

function parseLine(line) {
  if (!line) return null
  if (Array.isArray(line) && line.length === 2) {
    const [a, b] = line
    if (Array.isArray(a)) return [a, b]
    if (a.lat != null) return [[a.lat, a.lng], [b.lat, b.lng]]
  }
  return null
}

// ── Overlay widgets ───────────────────────────────────────────────────────────

function HudBox({ children, className = '' }) {
  return (
    <div className={`bg-gray-950/85 backdrop-blur border border-gray-700 rounded-xl cursor-grab active:cursor-grabbing ${className}`}>
      {children}
    </div>
  )
}

function SpeedWidget() {
  const { position, engineOn } = useRaceStore()
  const kmh = position?.speed_kmh ?? null
  return (
    <HudBox className="p-3 min-w-[180px]">
      <SpeedDial kmh={kmh} size={160} />
      <div className={`mt-1 text-center text-xs font-bold px-2 py-1 rounded-lg ${engineOn ? 'bg-green-900/60 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
        {engineOn ? '▶ ENGINE ON' : '■ ENGINE OFF'}
      </div>
    </HudBox>
  )
}

function LapWidget() {
  const { currentLap, totalLaps } = useRaceStore()
  return (
    <HudBox className="px-4 py-3 text-center">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Lap</div>
      <div className="font-mono font-bold leading-none" style={{ fontSize: 36 }}>
        <span className="text-white">{currentLap}</span>
        <span className="text-gray-600 text-xl"> / {totalLaps}</span>
      </div>
    </HudBox>
  )
}

const FUEL_LIMIT = 100

function TempRow({ label, value, max, warn, color }) {
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100))
  const hot = value != null && value > warn
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-7 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800/80 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: hot ? '#DD1D21' : color }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right font-bold ${hot ? 'text-red-400' : 'text-white'}`}>
        {value != null ? `${value.toFixed(0)}°` : '—'}
      </span>
    </div>
  )
}

function EngineWidget() {
  const { ecuData, engineOn } = useRaceStore()
  const e = ecuData ?? {}
  const fuelPct = Math.min(100, ((e.FuelTotal_ml ?? 0) / FUEL_LIMIT) * 100)
  const overLimit = (e.FuelTotal_ml ?? 0) > FUEL_LIMIT * 0.9

  return (
    <HudBox className="p-2.5 flex flex-col gap-2 min-w-[200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engine · Fuel</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${engineOn ? 'bg-green-900/70 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
          {engineOn ? '▶ ON' : '■ OFF'}
        </span>
      </div>

      {/* Temps */}
      <div className="flex flex-col gap-1.5">
        <TempRow label="ECT" value={e.ECT} max={120} warn={100} color="#FBCE07" />
        <TempRow label="IAT" value={e.IAT} max={60}  warn={50}  color="#60a5fa" />
      </div>

      {/* ECU grid */}
      <div className="grid grid-cols-4 gap-1 text-xs">
        {[
          { k: 'MAP',   v: e.MAP,   u: 'kPa', c: 'text-blue-400'   },
          { k: 'TPS',   v: e.TPS,   u: '%',   c: 'text-green-400'  },
          { k: 'SPARK', v: e.SPARK, u: '°',   c: 'text-yellow-300' },
          { k: 'O2S',   v: e.O2S,   u: 'V',   c: 'text-purple-400' },
        ].map(({ k, v, u, c }) => (
          <div key={k} className="bg-gray-800/70 rounded p-1 text-center">
            <div className="text-gray-500" style={{ fontSize: 9 }}>{k}</div>
            <div className={`font-mono font-bold ${c}`} style={{ fontSize: 11 }}>
              {v != null ? v.toFixed(1) : '—'}
              <span className="text-gray-600" style={{ fontSize: 9 }}>{u}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Fuel total bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">⛽ Total used</span>
          <span className={`font-mono font-bold ${overLimit ? 'text-red-400' : 'text-orange-400'}`}>
            {e.FuelTotal_ml != null ? `${e.FuelTotal_ml.toFixed(1)} / ${FUEL_LIMIT} ml` : '—'}
          </span>
        </div>
        <div className="h-2 bg-gray-800/80 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${fuelPct}%`, background: overLimit ? '#DD1D21' : '#FBCE07' }} />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Live rate</span>
          <span className="font-mono text-orange-400">
            {e.FuelConsumption_g_min != null ? `${e.FuelConsumption_g_min.toFixed(2)} g/min` : '—'}
          </span>
        </div>
      </div>

    </HudBox>
  )
}


// ─────────────────────────────────────────────────────────────────────────────

export default function Map() {
  const { position, lapTrail, engineEvents, corners, startLine, lapLine, finishLine } = useRaceStore()
  const startPts  = parseLine(startLine)
  const lapPts    = parseLine(lapLine)
  const finishPts = parseLine(finishLine)

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 h-full min-h-[320px] relative">
      <MapContainer
        center={SILESIA_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        zoomSnap={0.1}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
      >
        <TileLayer url="https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga" attribution="" maxZoom={21} />

        <TrailLayer trail={lapTrail} />

        {startPts  && <Polyline positions={startPts}  color="#22c55e" weight={5} dashArray="8 4" />}
        {lapPts    && <Polyline positions={lapPts}    color="#FBCE07" weight={5} dashArray="8 4" />}
        {finishPts && <Polyline positions={finishPts} color="#DD1D21" weight={5} dashArray="8 4" />}

        {corners.map((c, i) => {
          const lat = c.lat ?? c.latitude, lng = c.lng ?? c.longitude
          if (!lat || !lng) return null
          return <Marker key={i} position={[lat, lng]} icon={cornerIcon()} />
        })}

        {engineEvents.map((ev, i) => (
          <Marker key={ev.t ?? i} position={[ev.lat, ev.lng]} icon={engineEventIcon(ev)} />
        ))}

        {position?.latitude && (
          <Marker position={[position.latitude, position.longitude]} icon={makeCarIcon(speedColor(position.speed_kmh))} />
        )}

        <InvalidateSize />
        <FitToTrail trail={lapTrail} />
      </MapContainer>

      {/* Draggable overlays — rendered outside MapContainer but inside the relative wrapper */}
      <Draggable defaultX={12} defaultY={12} storageKey="map-speed">
        <SpeedWidget />
      </Draggable>

      <Draggable defaultX={12} defaultY={310} storageKey="map-engine">
        <EngineWidget />
      </Draggable>

      <Draggable defaultX={215} defaultY={12} storageKey="map-lap">
        <LapWidget />
      </Draggable>

    </div>
  )
}
