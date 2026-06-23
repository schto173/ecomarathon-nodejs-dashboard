import { useState, useEffect, useRef } from 'react'
import ConnectionStatus from './ConnectionStatus'
import Map from './Map'
import LapStats from './LapStats'
import StrategyPanel from './StrategyPanel'

const BASE_WIDTH = 360
const STORAGE_KEY = 'right-panel-scale'

export default function Dashboard() {
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
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <ConnectionStatus />

      <div className="flex flex-1 overflow-hidden gap-2 p-2 min-w-0">
        {/* Map fills all remaining space */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <Map />
        </div>

        {/* Right panel — scales together on hover+wheel */}
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
    </div>
  )
}
