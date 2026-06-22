import ConnectionStatus from './ConnectionStatus'
import Map from './Map'
import LapStats from './LapStats'
import StrategyPanel from './StrategyPanel'

export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950">
      <ConnectionStatus />

      <div className="flex flex-1 overflow-hidden gap-2 p-2 min-w-0">
        {/* Map fills all remaining space */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <Map />
        </div>

        {/* Right panel: wider for lap table readability, scrollable */}
        <div className="w-80 flex flex-col gap-2 shrink-0 overflow-y-auto">
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
