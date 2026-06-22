import { useState, useEffect } from 'react'
import { useMqtt } from './hooks/useMqtt'
import { useRaceStore } from './store/raceStore'
import Dashboard from './components/Dashboard'
import SimulatorPage from './components/SimulatorPage'

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const handler = () => setHash(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  return hash
}

export default function App() {
  useMqtt()
  const hash = useHash()
  const trimTrail = useRaceStore((s) => s.trimTrail)

  // Trim old trail points every second regardless of whether GPS data is arriving
  useEffect(() => {
    const id = setInterval(trimTrail, 1000)
    return () => clearInterval(id)
  }, [trimTrail])

  return hash === '#/sim' ? <SimulatorPage /> : <Dashboard />
}
