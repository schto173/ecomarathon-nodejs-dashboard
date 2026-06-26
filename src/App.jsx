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

function fetchLive() {
  fetch('/api/live')
    .then(r => r.json())
    .then(data => useRaceStore.getState().setLiveData(data))
    .catch(() => {})
}

export default function App() {
  useMqtt()
  const hash = useHash()
  const trimTrail = useRaceStore((s) => s.trimTrail)

  useEffect(() => {
    const id = setInterval(trimTrail, 1000)
    return () => clearInterval(id)
  }, [trimTrail])

  useEffect(() => {
    const store = useRaceStore.getState()

    // Seed session laps on load (server holds them in memory until reset)
    fetch('/api/session')
      .then(r => r.json())
      .then(laps => { if (Array.isArray(laps) && laps.length > 0) store.setLapHistory(laps) })
      .catch(err => console.warn('session:', err))

    // Poll server every second — live positions, engine events, state snapshot
    function pollAll() {
      fetch('/api/state')
        .then(r => r.json())
        .then(({ position, ecuData, currentLap }) => {
          if (position) store.seedPosition(position)
          if (ecuData) store.setEcuData(ecuData)
          if (currentLap != null) store.setCurrentLap(currentLap)
        })
        .catch(() => {})
      fetchLive()
    }
    pollAll()
    const timer = setInterval(pollAll, 500)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return hash === '#/sim' ? <SimulatorPage /> : <Dashboard />
}
