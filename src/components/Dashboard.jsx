import { useState, useEffect, useRef } from 'react'
import ConnectionStatus from './ConnectionStatus'
import Map from './Map'
import LapStats from './LapStats'
import StrategyPanel from './StrategyPanel'

const BASE_WIDTH = 360
const STORAGE_KEY = 'right-panel-scale'

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
          <div className="flex justify-end">
            <a href="#/sim" className="text-xs text-gray-600 hover:text-shell-yellow transition-colors px-2 py-0.5 rounded border border-gray-800 hover:border-gray-600">
              Sim →
            </a>
          </div>
          <StrategyPanel />
          <LapStats />
        </div>
      </div>
    </div>
  )
}

function MobileDashboard() {
  const [tab, setTab] = useState('stats')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-900 shrink-0">
        {[
          { id: 'stats', label: 'Strategy & Laps' },
          { id: 'map', label: 'Map' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-shell-yellow border-b-2 border-shell-yellow'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'stats' ? (
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
          <StrategyPanel />
          <LapStats />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Map />
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
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
