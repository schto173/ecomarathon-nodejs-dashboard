import { useRaceStore } from '../store/raceStore'
import { Zap, Battery } from 'lucide-react'

function TempBar({ label, value, max, color, warn }) {
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100))
  const hot = value != null && value > warn
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-7 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: hot ? '#DD1D21' : color }} />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${hot ? 'text-red-400' : 'text-white'}`}>
        {value != null ? `${value.toFixed(0)}°` : '—'}
      </span>
    </div>
  )
}

function Pill({ label, value, unit, color = 'text-white' }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-mono font-bold text-sm ${color}`}>
        {value != null ? `${typeof value === 'number' ? value.toFixed(1) : value}` : '—'}
        {value != null && <span className="text-xs font-normal text-gray-500 ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

export default function EnginePanel() {
  const { ecuData, engineOn } = useRaceStore()
  const e = ecuData ?? {}

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Zap size={12} className="text-shell-yellow" /> Engine
        </div>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${engineOn ? 'bg-green-900/60 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
          {engineOn ? '▶ ON' : '■ OFF'}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <TempBar label="ECT" value={e.ECT} max={120} warn={100} color="#FBCE07" />
        <TempBar label="IAT" value={e.IAT} max={60} warn={50} color="#60a5fa" />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Pill label="MAP" value={e.MAP} unit="kPa" color="text-blue-400" />
        <Pill label="TPS" value={e.TPS} unit="%" color="text-green-400" />
        <Pill label="SPARK" value={e.SPARK} unit="°" color="text-yellow-300" />
        <Pill label="O2S" value={e.O2S} unit="V" color="text-purple-400" />
      </div>

      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${e.UbAdc != null && e.UbAdc < 11.5 ? 'bg-red-900/40' : 'bg-gray-800'}`}>
        <Battery size={13} className={e.UbAdc != null && e.UbAdc < 11.5 ? 'text-red-400' : 'text-green-400'} />
        <span className="text-xs text-gray-400">Battery</span>
        <span className={`ml-auto font-mono text-sm font-bold ${e.UbAdc != null && e.UbAdc < 11.5 ? 'text-red-400' : 'text-white'}`}>
          {e.UbAdc != null ? `${e.UbAdc.toFixed(2)} V` : '—'}
        </span>
      </div>
    </div>
  )
}
