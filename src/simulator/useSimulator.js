import { useRef, useState, useCallback } from 'react'
import { useRaceStore } from '../store/raceStore'
import { WAYPOINTS, LAP_DISTANCE } from './lapData'

// Eco-marathon pulse-and-glide physics constants
const ACCEL_MS2  = 0.38        // m/s² engine-on acceleration
const DECEL_MS2  = 0.17        // m/s² coast deceleration
const SPEED_HIGH = 38 / 3.6   // ~10.56 m/s → engine OFF
const SPEED_LOW  = 20 / 3.6   // ~5.56  m/s → engine ON
const DT_MS      = 100         // physics step size

// Steps per timer tick per speed setting (each step = DT_MS of sim time)
const STEPS = { slow: 1, normal: 2, fast: 5 }

// Plain function — not a hook, no hook order concerns
function physicsStep(st, store, setStats) {
  const dtSec = DT_MS / 1000

  // Pulse-and-glide logic: coast high → regen low
  if (st.engineOn && st.speedMs >= SPEED_HIGH) st.engineOn = false
  if (!st.engineOn && st.speedMs <= SPEED_LOW) st.engineOn = true

  // Speed update
  if (st.engineOn) {
    st.speedMs = Math.min(SPEED_HIGH + 0.3, st.speedMs + ACCEL_MS2 * dtSec)
  } else {
    st.speedMs = Math.max(0, st.speedMs - DECEL_MS2 * dtSec)
  }

  const speed_kmh = st.speedMs * 3.6

  // Advance distance along track
  st.distM += st.speedMs * dtSec
  const distInLap = st.distM % LAP_DISTANCE
  const rawIdx    = (distInLap / LAP_DISTANCE) * WAYPOINTS.length
  const idxA      = Math.min(Math.floor(rawIdx),     WAYPOINTS.length - 1)
  const idxB      = Math.min(Math.floor(rawIdx) + 1, WAYPOINTS.length - 1)
  const frac      = rawIdx % 1
  const wpA = WAYPOINTS[idxA]
  const wpB = WAYPOINTS[idxB]

  const lat  = wpA.lat  + (wpB.lat  - wpA.lat)  * frac
  const lng  = wpA.lng  + (wpB.lng  - wpA.lng)  * frac
  const elev = wpA.elev + (wpB.elev - wpA.elev) * frac
  const heading = (Math.atan2(wpB.lng - wpA.lng, wpB.lat - wpA.lat) * 180 / Math.PI + 360) % 360

  // ECU evolution
  if (st.engineOn) {
    st.ect = Math.min(88, st.ect + 0.12 * dtSec)
  } else {
    st.ect = Math.max(st.lapCount > 0 ? 60 : 18, st.ect - 0.05 * dtSec)
  }
  st.ubAdc = Math.max(11.8, st.ubAdc - 0.0004 * dtSec)

  const fuelRate    = st.engineOn ? 4.0 + Math.sin(st.distM * 0.05) * 0.8 : 0
  const fuelDeltaMl = fuelRate * (dtSec / 60) * (1000 / 750)
  st.fuelTotal += fuelDeltaMl

  // Inject into store
  store.setPosition({ latitude: lat, longitude: lng, altitude: elev, speed_kmh, heading, timestamp: new Date().toISOString() })

  // Use fixed RPM when engine on so transition fires at exactly 20 km/h,
  // not at the 300-RPM threshold (~27 km/h). Speed display uses position.speed_kmh, not RPM.
  const rpm = st.engineOn ? 2000 : 0
  store.setSpeedData({ rpm, count: Math.floor(st.distM) })

  store.setEcuData({
    FuelTotal_ml:           st.fuelTotal,
    FuelConsumption_g_min:  fuelRate,
    ECT:    st.ect,
    IAT:    23 + Math.sin(st.distM * 0.01) * 2,
    MAP:    st.engineOn ? 80 + Math.random() * 12 : 33 + Math.random() * 6,
    TPS:    st.engineOn ? 32 + Math.random() * 22 : 0,
    O2S:    st.engineOn ? 0.45 + (Math.random() - 0.5) * 0.16 : 0,
    SPARK:  st.engineOn ? 18  + Math.random() * 7  : 0,
    FUELPW1: st.engineOn ? 2.7 + Math.random() * 0.7 : 0,
    FUELPW2: st.engineOn ? 2.6 + Math.random() * 0.7 : 0,
    UbAdc:  st.ubAdc,
    RPM:    rpm,
  })

  // Lap completion check
  const lapsDone = Math.floor(st.distM / LAP_DISTANCE)
  if (lapsDone > st.lapCount) {
    const lapDuration  = (Date.now() - st.lapStartMs) / 1000
    const fuelThisLap  = st.fuelTotal - st.fuelLapStart
    store.addLap({
      lap:           st.lapCount + 1,
      duration:      lapDuration,
      fuel_lap:      fuelThisLap,
      fuel_race:     st.fuelTotal,
      distance:      LAP_DISTANCE,
      speed:         speed_kmh,
      projection:    st.fuelTotal + fuelThisLap * Math.max(0, 8 - (st.lapCount + 1)),
      lap_ideal_diff: lapDuration - 185,
    })
    st.lapCount++
    st.lapStartMs   = Date.now()
    st.fuelLapStart = st.fuelTotal
    store.setCurrentLap(st.lapCount + 1)
    if (st.lapCount >= 8) {
      store.setInfoText('🏁 Simulation complete!')
      return false
    }
  }

  setStats({ dist: Math.round(distInLap), lap: st.lapCount + 1, speedKmh: speed_kmh.toFixed(1) })
  return true
}

export function useSimulator() {
  const timerRef = useRef(null)
  const stateRef = useRef(null)
  const [running, setRunning] = useState(false)
  const [speed,   setSpeed]   = useState('normal')
  const [stats,   setStats]   = useState({ dist: 0, lap: 1, speedKmh: '0.0' })

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    stop()
    stateRef.current = null
    setStats({ dist: 0, lap: 1, speedKmh: '0.0' })
    const s = useRaceStore.getState()
    s.clearLaps()
    s.setCurrentLap(1)
    s.setInfoText('Simulator reset')
  }, [stop])

  const start = useCallback((speedKey) => {
    stop()
    const key   = speedKey ?? speed
    const steps = STEPS[key] ?? 2

    if (!stateRef.current) {
      stateRef.current = {
        speedMs: 0, engineOn: false,
        distM: 0, lapCount: 0,
        lapStartMs: Date.now(), fuelTotal: 0, fuelLapStart: 0,
        ect: 20, ubAdc: 12.7,
      }
    }

    const store = useRaceStore.getState()
    store.setTotalLaps(8)
    store.setIdealLapTime(185)
    store.setCurrentLap(stateRef.current.lapCount + 1)
    store.setInfoText('🟢 Simulator · pulse-and-glide 20→38 km/h')
    store.setGpsStatus({ fix: true, satellites: 9, hdop: 0.7 })

    setRunning(true)
    timerRef.current = setInterval(() => {
      const st = stateRef.current
      const s  = useRaceStore.getState()
      for (let i = 0; i < steps; i++) {
        const ok = physicsStep(st, s, setStats)
        if (!ok) { stop(); return }
      }
    }, DT_MS)
  }, [speed, stop])

  return { running, speed, setSpeed, stats, start, stop, reset }
}
