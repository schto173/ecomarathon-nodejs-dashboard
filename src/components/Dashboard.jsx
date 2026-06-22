import ConnectionStatus from './ConnectionStatus'
import Map from './Map'
import LapStats from './LapStats'
import FuelGauge from './FuelGauge'
import StrategyPanel from './StrategyPanel'

export default function Dashboard() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-gray-950 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-shell-yellow" />
          <span className="font-bold text-white tracking-tight">EcoMarathon Strategy</span>
        </div>
        <span className="text-xs text-gray-600 font-mono">tome.lu:1883</span>
      </header>

      <ConnectionStatus />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3">
        {/* Left: Map takes most space */}
        <div className="flex-1 min-w-0">
          <Map />
        </div>

        {/* Right sidebar */}
        <div className="w-80 flex flex-col gap-3 overflow-y-auto shrink-0">
          <StrategyPanel />
          <FuelGauge />
          <LapStats />
        </div>
      </div>
    </div>
  )
}
