import { create } from 'zustand'

export const useRaceStore = create((set, get) => ({
  // Connection
  mqttConnected: false,
  setMqttConnected: (v) => set({ mqttConnected: v }),

  // GPS
  position: null,          // { latitude, longitude, altitude, speed_kmh, heading, timestamp }
  positionHistory: [],     // last N positions for trail
  gpsStatus: null,         // { has_fix, fix_quality, num_satellites }
  setPosition: (pos) =>
    set((s) => ({
      position: pos,
      positionHistory: [...s.positionHistory.slice(-199), pos],
    })),
  setGpsStatus: (st) => set({ gpsStatus: st }),

  // ECU / fuel
  ecuData: null,           // { FuelTotal_ml, FuelConsumption_g_min }
  setEcuData: (d) => set({ ecuData: d }),

  // Race state
  currentLap: 0,
  totalLaps: 10,
  idealLapTime: null,      // seconds
  infoText: '',
  setCurrentLap: (n) => set({ currentLap: n }),
  setTotalLaps: (n) => set({ totalLaps: n }),
  setIdealLapTime: (t) => set({ idealLapTime: t }),
  setInfoText: (t) => set({ infoText: t }),

  // Lap history  [{ lap, duration, fuel_lap, fuel_race, distance, speed, projection, lap_ideal_diff }]
  lapHistory: [],
  addLap: (data) => set((s) => ({ lapHistory: [...s.lapHistory, data] })),
  clearLaps: () => set({ lapHistory: [], currentLap: 0 }),

  // Strategy
  // Computed: remaining laps, projected fuel needed, pace delta
  getStrategyStats: () => {
    const { currentLap, totalLaps, lapHistory, idealLapTime, ecuData } = get()
    const remainingLaps = Math.max(0, totalLaps - currentLap)
    const lastLap = lapHistory[lapHistory.length - 1] ?? null
    const avgLapTime =
      lapHistory.length > 0
        ? lapHistory.reduce((s, l) => s + l.duration, 0) / lapHistory.length
        : null
    const avgFuelPerLap =
      lapHistory.length > 0
        ? lapHistory.reduce((s, l) => s + l.fuel_lap, 0) / lapHistory.length
        : null
    const projectedTotalFuel =
      avgFuelPerLap != null
        ? ecuData?.FuelTotal_ml + avgFuelPerLap * remainingLaps
        : null
    const paceDelta =
      avgLapTime != null && idealLapTime != null
        ? avgLapTime - idealLapTime
        : null

    return {
      remainingLaps,
      lastLap,
      avgLapTime,
      avgFuelPerLap,
      projectedTotalFuel,
      paceDelta,
    }
  },
}))
