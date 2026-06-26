import { create } from 'zustand'

const DEFAULT_TRAIL_MS = 160_000  // idealLapTime(183) - 20 = 163 s, default 160 s

const SPEED_STOPS = [
  { t: 0,    r: 30,  g: 58,  b: 180 },
  { t: 0.25, r: 6,   g: 182, b: 212 },
  { t: 0.5,  r: 52,  g: 211, b: 153 },
  { t: 0.75, r: 251, g: 191, b: 36  },
  { t: 1,    r: 220, g: 38,  b: 38  },
]
const SLOW_KMH = 18, FAST_KMH = 40

function speedColorRgb(kmh) {
  if (kmh == null || kmh < 1) return '#374151'
  const t = Math.min(1, Math.max(0, (kmh - SLOW_KMH) / (FAST_KMH - SLOW_KMH)))
  let lo = SPEED_STOPS[0], hi = SPEED_STOPS[SPEED_STOPS.length - 1]
  for (let i = 0; i < SPEED_STOPS.length - 1; i++) {
    if (t >= SPEED_STOPS[i].t && t <= SPEED_STOPS[i + 1].t) { lo = SPEED_STOPS[i]; hi = SPEED_STOPS[i + 1]; break }
  }
  const f = lo.t === hi.t ? 0 : (t - lo.t) / (hi.t - lo.t)
  return `rgb(${Math.round(lo.r+(hi.r-lo.r)*f)},${Math.round(lo.g+(hi.g-lo.g)*f)},${Math.round(lo.b+(hi.b-lo.b)*f)})`
}

export const useRaceStore = create((set, get) => ({
  // Connection
  mqttConnected: false,
  setMqttConnected: (v) => set({ mqttConnected: v }),

  // GPS
  position: null,         // { latitude, longitude, altitude, speed_kmh, heading, timestamp }
  livePositions: [],      // rolling 160 s window from server — { lat, lng, speed_kmh, t }
  gpsStatus: null,
  setPosition: (pos) => set({ position: pos }),
  seedPosition: (pos) => set({ position: pos }),
  setGpsStatus: (st) => set({ gpsStatus: st }),

  // Live data from /api/live — replaces both trail sources
  setLiveData: ({ positions, engineEvents }) => set((s) => {
    const lastEv = engineEvents?.[engineEvents.length - 1]
    return {
      livePositions: Array.isArray(positions) ? positions : s.livePositions,
      engineEvents: Array.isArray(engineEvents) ? engineEvents : s.engineEvents,
      engineOn: lastEv ? lastEv.type === 'start' : s.engineOn,
    }
  }),

  // ECU / fuel — full field set from ecu/data topic
  ecuData: null,
  ecuHistory: [],
  setEcuData: (d) =>
    set((s) => ({
      ecuData: d,
      ecuHistory: [...s.ecuHistory.slice(-299), { ...d, t: Date.now() }],
    })),

  // Speed sensor (speed/data topic)
  speedData: null,
  speedHistory: [],
  setSpeedData: (d) =>
    set((s) => {
      const speed_kmh = (d.rpm ?? 0) * 0.0894
      const sample = { ...d, t: Date.now(), speed_kmh }
      return {
        speedData: d,
        speedHistory: [...s.speedHistory.slice(-299), sample],
      }
    }),

  // Engine events — computed server-side, published via race/engine_event
  engineEvents: [], // { type:'start'|'stop', lat, lng, speed_kmh, t }
  engineOn: false,
  addEngineEvent: (ev) =>
    set((s) => {
      const trailMs = s.idealLapTime ? Math.max(30_000, (s.idealLapTime - 20) * 1000) : DEFAULT_TRAIL_MS
      const cutoff = Date.now() - trailMs
      return {
        engineEvents: [...s.engineEvents, { ...ev, t: ev.t ?? Date.now() }].filter(e => e.t >= cutoff),
        engineOn: ev.type === 'start',
      }
    }),

  trimTrail: () => {},  // trimming now handled server-side

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

  // Selected lap for replay / analysis
  selectedLap: null,
  setSelectedLap: (lap) => set({ selectedLap: lap }),
  clearSelectedLap: () => set({ selectedLap: null }),

  // Lap history
  lapHistory: [],
  addLap: (data) =>
    set((s) => {
      const map = new Map(s.lapHistory.map(l => [l.lap, l]))
      const existing = map.get(data.lap)
      // MQTT payload never includes trail/engineEvents — keep them from existing entry
      map.set(data.lap, {
        ...(existing ?? {}),
        ...data,
        trail:        data.trail        ?? existing?.trail,
        engineEvents: data.engineEvents ?? existing?.engineEvents,
      })
      return { lapHistory: [...map.values()].sort((a, b) => a.lap - b.lap) }
    }),
  // Hydrate from API; incoming laps carry trail/engineEvents — don't let MQTT-cached
  // copies (which lack trail) silently overwrite them
  setLapHistory: (laps) =>
    set((s) => {
      const storeMap = new Map(s.lapHistory.map(l => [l.lap, l]))
      const merged = laps.map(incoming => {
        const existing = storeMap.get(incoming.lap)
        return {
          ...(existing ?? {}),
          ...incoming,
          trail:        incoming.trail        ?? existing?.trail,
          engineEvents: incoming.engineEvents ?? existing?.engineEvents,
        }
      })
      // Add any store laps not present in the incoming list
      for (const l of s.lapHistory) {
        if (!merged.find(m => m.lap === l.lap)) merged.push(l)
      }
      return { lapHistory: merged.sort((a, b) => a.lap - b.lap) }
    }),
  clearLaps: () => set({ lapHistory: [], currentLap: 0, livePositions: [], engineEvents: [] }),

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
