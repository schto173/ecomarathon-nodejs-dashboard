import { create } from 'zustand'

const ENGINE_ON_RPM = 300
const TRAIL_WINDOW_MS = 60_000

const BLUE = { r: 30,  g: 58,  b: 180 }
const RED  = { r: 221, g: 29,  b: 33  }
const SLOW_KMH = 18, FAST_KMH = 40

function speedColorRgb(kmh) {
  if (kmh == null || kmh < 1) return '#374151'
  if (kmh <= SLOW_KMH) return `rgb(${BLUE.r},${BLUE.g},${BLUE.b})`
  if (kmh >= FAST_KMH) return `rgb(${RED.r},${RED.g},${RED.b})`
  const t = (kmh - SLOW_KMH) / (FAST_KMH - SLOW_KMH)
  return `rgb(${Math.round(BLUE.r+(RED.r-BLUE.r)*t)},${Math.round(BLUE.g+(RED.g-BLUE.g)*t)},${Math.round(BLUE.b+(RED.b-BLUE.b)*t)})`
}

export const useRaceStore = create((set, get) => ({
  // Connection
  mqttConnected: false,
  setMqttConnected: (v) => set({ mqttConnected: v }),

  // GPS
  position: null,          // { latitude, longitude, altitude, speed_kmh, heading, timestamp }
  positionHistory: [],     // last 500 positions for full trail (with speed + engineOn flag)
  lapTrail: [],            // positions since start of current lap (reset each lap)
  gpsStatus: null,
  setPosition: (pos) =>
    set((s) => {
      const engineOn = (s.speedData?.rpm ?? 0) >= ENGINE_ON_RPM
      const fuelRate = s.ecuData?.FuelConsumption_g_min ?? null
      // Pre-compute and freeze the speed color so it never changes once assigned
      const _color = speedColorRgb(pos.speed_kmh)
      const now = Date.now()
      const enriched = { ...pos, engineOn, fuelRate, _t: now, _color }
      const cutoff = now - TRAIL_WINDOW_MS
      return {
        position: pos,
        positionHistory: [...s.positionHistory.slice(-499), enriched],
        lapTrail: [...s.lapTrail, enriched].filter(p => p._t >= cutoff),
      }
    }),
  setGpsStatus: (st) => set({ gpsStatus: st }),

  // ECU / fuel — full field set from ecu/data topic
  ecuData: null,
  ecuHistory: [],
  setEcuData: (d) =>
    set((s) => ({
      ecuData: d,
      ecuHistory: [...s.ecuHistory.slice(-299), { ...d, t: Date.now() }],
    })),

  // Speed sensor (speed/data topic) — also detects engine on/off transitions
  speedData: null,
  speedHistory: [],
  engineEvents: [], // { type:'start'|'stop', lat, lng, speed_kmh, fuelRate, rpm, t }
  engineOn: false,
  setSpeedData: (d) =>
    set((s) => {
      const prevRpm = s.speedData?.rpm ?? 0
      const newRpm = d.rpm ?? 0
      const wasOn = prevRpm >= ENGINE_ON_RPM
      const isOn = newRpm >= ENGINE_ON_RPM
      const speed_kmh = newRpm * 0.0894
      const sample = { ...d, t: Date.now(), speed_kmh }

      let newEngineEvents = s.engineEvents
      if (!wasOn && isOn && s.position) {
        newEngineEvents = [...s.engineEvents, {
          type: 'start', rpm: newRpm,
          lat: s.position.latitude, lng: s.position.longitude,
          speed_kmh: s.position.speed_kmh ?? speed_kmh,
          fuelRate: s.ecuData?.FuelConsumption_g_min ?? null,
          t: Date.now(),
        }]
      } else if (wasOn && !isOn && s.position) {
        newEngineEvents = [...s.engineEvents, {
          type: 'stop', rpm: prevRpm,
          lat: s.position.latitude, lng: s.position.longitude,
          speed_kmh: s.position.speed_kmh ?? 0,
          fuelRate: s.ecuData?.FuelConsumption_g_min ?? null,
          t: Date.now(),
        }]
      }

      const cutoff = Date.now() - TRAIL_WINDOW_MS
      return {
        speedData: d,
        engineOn: isOn,
        speedHistory: [...s.speedHistory.slice(-299), sample],
        engineEvents: newEngineEvents.filter(ev => ev.t >= cutoff),
      }
    }),

  // Periodic cleanup — call every second even when no GPS data arrives
  trimTrail: () => set((s) => {
    const cutoff = Date.now() - TRAIL_WINDOW_MS
    return {
      lapTrail: s.lapTrail.filter(p => p._t >= cutoff),
      engineEvents: s.engineEvents.filter(ev => ev.t >= cutoff),
    }
  }),

  // Race config from MQTT
  corners: [],        // [{ lat, lng, name? }]
  startLine: null,    // { lat, lng } or GeoJSON
  lapLine: null,
  finishLine: null,
  setCorners: (c) => set({ corners: Array.isArray(c) ? c : [] }),
  setStartLine: (v) => set({ startLine: v }),
  setLapLine: (v) => set({ lapLine: v }),
  setFinishLine: (v) => set({ finishLine: v }),

  // Race state
  currentLap: 0,
  totalLaps: 10,
  idealLapTime: null,
  infoText: '',
  setCurrentLap: (n) => set({ currentLap: n }),
  setTotalLaps: (n) => set({ totalLaps: n }),
  setIdealLapTime: (t) => set({ idealLapTime: t }),
  setInfoText: (t) => set({ infoText: t }),

  // Lap history
  lapHistory: [],
  addLap: (data) =>
    set((s) => ({
      lapHistory: [...s.lapHistory, data],
    })),
  clearLaps: () => set({ lapHistory: [], currentLap: 0, lapTrail: [], engineEvents: [] }),

  // Computed strategy stats
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
      avgFuelPerLap != null ? (ecuData?.FuelTotal_ml ?? 0) + avgFuelPerLap * remainingLaps : null
    const paceDelta =
      avgLapTime != null && idealLapTime != null ? avgLapTime - idealLapTime : null

    return { remainingLaps, lastLap, avgLapTime, avgFuelPerLap, projectedTotalFuel, paceDelta }
  },
}))
