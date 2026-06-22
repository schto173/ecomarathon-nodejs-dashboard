import { useRaceStore } from '../store/raceStore'
import { Wifi, WifiOff } from 'lucide-react'

export default function ConnectionStatus() {
  const { mqttConnected, gpsStatus, infoText } = useRaceStore()

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800">
      <div className={`flex items-center gap-1.5 text-sm font-medium ${mqttConnected ? 'text-green-400' : 'text-red-400'}`}>
        {mqttConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
        {mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
      </div>

      {gpsStatus && (
        <div className={`flex items-center gap-1.5 text-sm ${gpsStatus.has_fix ? 'text-green-400' : 'text-yellow-400'}`}>
          <span className={`w-2 h-2 rounded-full ${gpsStatus.has_fix ? 'bg-green-400' : 'bg-yellow-400'}`} />
          GPS {gpsStatus.has_fix ? `${gpsStatus.num_satellites} sats` : 'No fix'}
        </div>
      )}

      {infoText && (
        <div className="ml-auto text-sm text-shell-yellow font-medium truncate max-w-xs">
          {infoText}
        </div>
      )}
    </div>
  )
}
