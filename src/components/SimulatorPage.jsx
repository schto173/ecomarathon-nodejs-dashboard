import SimulatorControl from './SimulatorControl'
import { useRaceStore } from '../store/raceStore'

export default function SimulatorPage() {
  const { mqttConnected } = useRaceStore()

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      <header className="flex items-center gap-3 px-4 py-3 bg-gray-950 border-b border-gray-800 shrink-0">
        <svg width="20" height="20" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#FBCE07" />
          <text x="20" y="26" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#DD1D21">S</text>
        </svg>
        <span className="font-bold text-white tracking-tight text-sm">EcoMarathon · Simulator</span>
        <a href="#/" className="ml-auto text-xs text-gray-500 hover:text-shell-yellow transition-colors">
          ← Dashboard
        </a>
      </header>

      {/* Hidden on mobile — simulator is a desktop-only tool */}
      <div className="hidden md:flex flex-1 items-start justify-center p-6 overflow-auto">
        <div className="w-80 flex flex-col gap-4">
          <div className="text-sm text-gray-400">
            Publishes sensor data to MQTT — <span className="font-mono text-gray-300">gps/position</span>, <span className="font-mono text-gray-300">ecu/data</span>, <span className="font-mono text-gray-300">speed/data</span> — exactly as the car does. Open the{' '}
            <a href="#/" className="text-shell-yellow hover:underline">Dashboard</a> to see live data.
          </div>
          <SimulatorControl />
          <div className={`text-xs px-3 py-2 rounded-lg border ${mqttConnected ? 'border-green-800 text-green-400 bg-green-900/20' : 'border-gray-700 text-gray-500'}`}>
            {mqttConnected ? '● MQTT connected — live data active alongside simulator' : '○ MQTT disconnected'}
          </div>
        </div>
      </div>

      {/* Mobile message */}
      <div className="md:hidden flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-gray-600 text-sm">Simulator is only available on desktop.</p>
      </div>
    </div>
  )
}
