import { useRaceStore } from '../store/raceStore'
import { Wifi, WifiOff } from 'lucide-react'
import SimControl from './SimControl'

export default function ConnectionStatus() {
  const { mqttConnected, gpsStatus, infoText, ecuData } = useRaceStore()
  const battery = ecuData?.UbAdc ?? null
  const batLow = battery != null && battery < 11.5

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0">
      <div className={`flex items-center gap-1.5 text-sm font-medium shrink-0 ${mqttConnected ? 'text-green-400' : 'text-red-400'}`}>
        {mqttConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span className="hidden sm:inline">{mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}</span>
        <span className="sm:hidden">{mqttConnected ? 'Live' : 'Off'}</span>
      </div>

      {gpsStatus && (
        <div className={`flex items-center gap-1 text-xs shrink-0 ${gpsStatus.has_fix ? 'text-green-400' : 'text-yellow-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${gpsStatus.has_fix ? 'bg-green-400' : 'bg-yellow-400'}`} />
          <span className="hidden sm:inline">GPS {gpsStatus.has_fix ? `${gpsStatus.num_satellites} sats` : 'No fix'}</span>
        </div>
      )}

      {battery != null && (
        <div className={`text-xs font-mono font-bold shrink-0 ${batLow ? 'text-red-400' : 'text-green-400'}`}>
          🔋 {battery.toFixed(1)}V
        </div>
      )}

      {infoText && (
        <div className="text-xs text-shell-yellow font-medium truncate max-w-[120px] sm:max-w-xs">
          {infoText}
        </div>
      )}

      <SimControl />
    </div>
  )
}
