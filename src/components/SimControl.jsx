import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, Square } from 'lucide-react'

export default function SimControl() {
  const [state, setState] = useState('stopped')  // 'playing' | 'paused' | 'stopped'
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)

  // Poll status every 2 s when playing, 5 s otherwise
  useEffect(() => {
    let id
    const poll = () => {
      fetch('/api/sim/status')
        .then(r => r.json())
        .then(s => { setState(s.state); setProgress(s.progress ?? 0) })
        .catch(() => {})
    }
    poll()
    id = setInterval(poll, state === 'playing' ? 2000 : 5000)
    return () => clearInterval(id)
  }, [state])

  const send = useCallback(async (action) => {
    setBusy(true)
    try {
      const r = await fetch(`/api/sim/${action}`, { method: 'POST' })
      const s = await r.json()
      setState(s.state)
      setProgress(s.progress ?? 0)
    } catch (e) {
      console.warn('sim control:', e)
    } finally {
      setBusy(false)
    }
  }, [])

  const pct = Math.round(progress * 100)

  return (
    <div className="hidden md:flex items-center gap-1.5 ml-auto">
      {state !== 'stopped' && (
        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gray-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      )}

      <span className="text-xs font-mono w-12 text-right text-gray-700">
        {state === 'playing' ? `${pct}%` : state === 'paused' ? 'PAUSED' : 'SIM'}
      </span>

      <button
        onClick={() => send(state === 'playing' ? 'pause' : 'play')}
        disabled={busy}
        className="p-1.5 rounded-lg bg-gray-800 text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
        title={state === 'playing' ? 'Pause simulation' : 'Play simulation'}
      >
        {state === 'playing' ? <Pause size={14} /> : <Play size={14} />}
      </button>

      {state !== 'stopped' && (
        <button
          onClick={() => send('stop')}
          disabled={busy}
          className="p-1.5 rounded-lg bg-gray-800 text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
          title="Stop simulation"
        >
          <Square size={14} />
        </button>
      )}
    </div>
  )
}
