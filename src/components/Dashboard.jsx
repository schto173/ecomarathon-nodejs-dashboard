import { useState, useEffect, useRef } from 'react'
import ConnectionStatus from './ConnectionStatus'
import Map from './Map'
import LapStats from './LapStats'
import StrategyPanel from './StrategyPanel'
import SpeedDial from './SpeedDial'
import { useRaceStore } from '../store/raceStore'

const BASE_WIDTH = 360
const STORAGE_KEY = 'right-panel-scale'

// ── Desktop (unchanged) ───────────────────────────────────────────────────────

function DesktopDashboard() {
  const [scale, setScale] = useState(() => {
    try { return parseFloat(localStorage.getItem(STORAGE_KEY) || '1') } catch { return 1 }
  })
  const hovered = useRef(false)
  const scaleRef = useRef(scale)
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(scale)) } catch {}
  }, [scale])

  const onWheel = (e) => {
    if (!hovered.current) return
    e.stopPropagation()
    e.preventDefault()
    setScale(s => Math.min(3, Math.max(0.4, s - e.deltaY * 0.001)))
  }

  return (
    <div className="flex flex-1 overflow-hidden gap-2 p-2 min-w-0">
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
        <Map />
      </div>
      <div
        className="shrink-0 overflow-y-auto overflow-x-hidden"
        style={{ width: Math.round(BASE_WIDTH * scale) }}
        onMouseEnter={() => { hovered.current = true }}
        onMouseLeave={() => { hovered.current = false }}
        onWheel={onWheel}
      >
        <div
          className="flex flex-col gap-2 origin-top-left"
          style={{ width: BASE_WIDTH, transform: `scale(${scale})` }}
        >
          <StrategyPanel />
          <LapStats />
          <div className="flex justify-end">
            <a href="#/sim" className="text-xs text-gray-700 hover:text-gray-500 transition-colors px-1">sim</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mobile live panel ─────────────────────────────────────────────────────────

const FUEL_LIMIT = 100

function fmt(s) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

function MobileLivePanel() {
  const { position, ecuData, engineOn, currentLap, totalLaps, lapHistory,
          selectedLap, clearSelectedLap } = useRaceStore()
  const kmh   = position?.speed_kmh ?? null
  const e     = ecuData ?? {}
  const lastLap = selectedLap ?? lapHistory[lapHistory.length - 1] ?? null
  const fuelPct = Math.min(100, ((e.FuelTotal_ml ?? 0) / FUEL_LIMIT) * 100)
  const overLimit = (e.FuelTotal_ml ?? 0) > FUEL_LIMIT * 0.9

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

      {/* Speed + engine */}
      <div className="flex items-center gap-3 bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <div className="flex-1 flex justify-center">
          <SpeedDial kmh={kmh} size={160} />
        </div>
        <div className="flex flex-col gap-2 items-center">
          {/* Engine indicator */}
          <div className={`px-3 py-2 rounded-xl text-center font-bold text-sm ${
            engineOn
              ? 'bg-green-900/60 text-green-400 border border-green-800'
              : 'bg-gray-800 text-gray-500 border border-gray-700'
          }`}>
            {engineOn ? '▶ ON' : '■ OFF'}
            <div className="text-xs font-normal mt-0.5 text-gray-400">Engine</div>
          </div>
          {/* Lap counter */}
          <div className="bg-gray-800 rounded-xl px-3 py-2 text-center border border-gray-700">
            <div className="text-2xl font-bold font-mono text-white leading-none">{currentLap}</div>
            <div className="text-xs text-gray-500 mt-0.5">/ {totalLaps} laps</div>
          </div>
        </div>
      </div>

      {/* Last / selected lap */}
      {lastLap && (
        <div className={`rounded-2xl border p-3 ${selectedLap ? 'bg-shell-yellow/5 border-shell-yellow/30' : 'bg-gray-900 border-gray-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              {selectedLap ? `Viewing lap` : 'Last lap'} · <span className={selectedLap ? 'text-shell-yellow font-bold' : ''}>#{lastLap.lap}</span>
            </div>
            {selectedLap && (
              <button onClick={clearSelectedLap} className="text-xs text-shell-yellow hover:text-white transition-colors font-semibold">← Live</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-800 rounded-xl p-2">
              <div className="text-xs text-gray-500 mb-0.5">Time</div>
              <div className="font-mono font-bold text-white text-sm">{fmt(lastLap.duration)}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-2">
              <div className="text-xs text-gray-500 mb-0.5">Avg km/h</div>
              <div className="font-mono font-bold text-yellow-400 text-sm">
                {lastLap.speed > 0 ? lastLap.speed.toFixed(1) : '—'}
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-2">
              <div className="text-xs text-gray-500 mb-0.5">Fuel ml</div>
              <div className="font-mono font-bold text-orange-400 text-sm">
                {lastLap.fuel_lap != null ? lastLap.fuel_lap.toFixed(1) : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ECU / fuel */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-3 flex flex-col gap-2.5">
        <div className="text-xs text-gray-500 uppercase tracking-wider">Engine data</div>

        {/* Temps */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Coolant', value: e.ECT, max: 120, warn: 100 },
            { label: 'Air',     value: e.IAT, max: 60,  warn: 50  },
          ].map(({ label, value, max, warn }) => {
            const pct = Math.min(100, ((value ?? 0) / max) * 100)
            const hot = value != null && value > warn
            return (
              <div key={label} className="bg-gray-800 rounded-xl p-2.5">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className={`text-sm font-mono font-bold ${hot ? 'text-red-400' : 'text-white'}`}>
                    {value != null ? `${value.toFixed(0)}°` : '—'}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hot ? '#ef4444' : '#FBCE07' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* ECU grid */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {[
            { k: 'MAP',   v: e.MAP,   u: 'kPa', c: 'text-blue-400'   },
            { k: 'TPS',   v: e.TPS,   u: '%',   c: 'text-green-400'  },
            { k: 'SPARK', v: e.SPARK, u: '°',   c: 'text-yellow-300' },
            { k: 'O2S',   v: e.O2S,   u: 'V',   c: 'text-purple-400' },
          ].map(({ k, v, u, c }) => (
            <div key={k} className="bg-gray-800 rounded-lg p-1.5 text-center">
              <div className="text-gray-500" style={{ fontSize: 9 }}>{k}</div>
              <div className={`font-mono font-bold ${c} text-xs`}>
                {v != null ? v.toFixed(1) : '—'}
                <span className="text-gray-600" style={{ fontSize: 9 }}>{u}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Fuel */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">⛽ Fuel used</span>
            <span className={`font-mono font-bold ${overLimit ? 'text-red-400' : 'text-orange-400'}`}>
              {e.FuelTotal_ml != null ? `${e.FuelTotal_ml.toFixed(1)} / ${FUEL_LIMIT} ml` : '—'}
            </span>
          </div>
          <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${fuelPct}%`, background: overLimit ? '#ef4444' : '#FBCE07' }} />
          </div>
          {e.FuelConsumption_g_min != null && (
            <div className="text-xs text-gray-500 mt-1 text-right">
              Live: <span className="text-orange-400 font-mono">{e.FuelConsumption_g_min.toFixed(2)} g/min</span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Mobile shell ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'live', label: 'Live' },
  { id: 'map',  label: 'Map'  },
  { id: 'laps', label: 'Laps' },
]

function MobileDashboard() {
  const [tab, setTab] = useState('live')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold tracking-wide transition-colors ${
              tab === t.id
                ? 'text-shell-yellow border-b-2 border-shell-yellow'
                : 'text-gray-500 active:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — keep map mounted so it doesn't re-init on tab switch */}
      <div className={`flex-1 min-h-0 overflow-hidden ${tab === 'map' ? 'flex flex-col' : 'hidden'}`}>
        <Map hideOverlays />
      </div>

      {tab === 'live' && <MobileLivePanel />}

      {tab === 'laps' && (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          <StrategyPanel />
          <LapStats />
        </div>
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1000)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1000)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <ConnectionStatus />
      {isMobile ? <MobileDashboard /> : <DesktopDashboard />}
    </div>
  )
}
