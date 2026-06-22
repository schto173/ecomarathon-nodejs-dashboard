import { useRaceStore } from '../store/raceStore'
import { Wifi, WifiOff } from 'lucide-react'

export default function ConnectionStatus() {
  const { mqttConnected, gpsStatus, infoText, ecuData } = useRaceStore()
  const battery = ecuData?.UbAdc ?? null
  const batLow = battery != null && battery < 11.5

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
      <div className={`flex items-center gap-1.5 text-sm font-medium ${mqttConnected ? 'text-green-400' : 'text-red-400'}`}>
        {mqttConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
        {mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
      </div>

      {gpsStatus && (
        <div className={`flex items-center gap-1.5 text-xs ${gpsStatus.has_fix ? 'text-green-400' : 'text-yellow-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${gpsStatus.has_fix ? 'bg-green-400' : 'bg-yellow-400'}`} />
          GPS {gpsStatus.has_fix ? `${gpsStatus.num_satellites} sats` : 'No fix'}
        </div>
      )}

      {battery != null && (
        <div className={`flex items-center gap-1.5 text-xs font-mono font-bold ${batLow ? 'text-red-400' : 'text-green-400'}`}>
          🔋 {battery.toFixed(2)} V
        </div>
      )}

      {infoText && (
        <div className="ml-auto text-xs text-shell-yellow font-medium truncate max-w-xs">
          {infoText}
        </div>
      )}
    </div>
  )
}
