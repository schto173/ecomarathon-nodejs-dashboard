import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mqtt from 'mqtt'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
const PORT = process.env.PORT || 80

// ── Speed colour (same as client) ─────────────────────────────────────────
const SPEED_STOPS = [
  { t: 0,    r: 30,  g: 58,  b: 180 },
  { t: 0.25, r: 6,   g: 182, b: 212 },
  { t: 0.5,  r: 52,  g: 211, b: 153 },
  { t: 0.75, r: 251, g: 191, b: 36  },
  { t: 1,    r: 220, g: 38,  b: 38  },
]
const SLOW_KMH = 18, FAST_KMH = 40

function speedColor(kmh) {
  if (!kmh || kmh < 1) return '#374151'
  const t = Math.min(1, Math.max(0, (kmh - SLOW_KMH) / (FAST_KMH - SLOW_KMH)))
  let lo = SPEED_STOPS[0], hi = SPEED_STOPS[SPEED_STOPS.length - 1]
  for (let i = 0; i < SPEED_STOPS.length - 1; i++) {
    if (t >= SPEED_STOPS[i].t && t <= SPEED_STOPS[i + 1].t) { lo = SPEED_STOPS[i]; hi = SPEED_STOPS[i + 1]; break }
  }
  const f = lo.t === hi.t ? 0 : (t - lo.t) / (hi.t - lo.t)
  return `rgb(${Math.round(lo.r+(hi.r-lo.r)*f)},${Math.round(lo.g+(hi.g-lo.g)*f)},${Math.round(lo.b+(hi.b-lo.b)*f)})`
}

// ── MQTT publisher ─────────────────────────────────────────────────────────
const MQTT_URL  = 'wss://mqtt-ws.tome.lu'
const MQTT_USER = 'eco'
const MQTT_PASS = 'marathon'

const mqttPub = mqtt.connect(MQTT_URL, {
  clientId: `eco-srv-${Math.random().toString(16).slice(2,8)}`,
  clean: true, reconnectPeriod: 3000,
  username: MQTT_USER, password: MQTT_PASS,
})
mqttPub.on('connect', () => console.log('MQTT publisher connected'))
mqttPub.on('error',   e  => console.error('MQTT pub error:', e.message))

function pub(topic, payload) {
  if (!mqttPub.connected) return  // drop silently while reconnecting
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload)
  mqttPub.publish(topic, str, { qos: 0, retain: false })
}

// ── Track data — loaded once from track.csv ───────────────────────────────
import { readFileSync, writeFileSync, existsSync } from 'fs'

function loadTrack() {
  const raw = readFileSync(join(__dirname, 'track.csv'), 'utf8')
  const lines = raw.trim().split('\n').slice(1)  // skip header
  return lines.map(line => {
    const [dist, elev, , , lng, lat] = line.split(',')
    return { dist: parseFloat(dist), lat: parseFloat(lat), lng: parseFloat(lng), elev: parseFloat(elev) }
  }).filter(p => isFinite(p.lat) && isFinite(p.lng))
}

const TRACK = loadTrack()
const TRACK_LEN = TRACK[TRACK.length - 1].dist  // metres

// Interpolate a position along the track at distance d (metres, wraps)
function trackAtDist(d) {
  const dd = ((d % TRACK_LEN) + TRACK_LEN) % TRACK_LEN
  let lo = 0, hi = TRACK.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (TRACK[mid].dist <= dd) lo = mid; else hi = mid
  }
  const a = TRACK[lo], b = TRACK[Math.min(lo + 1, TRACK.length - 1)]
  const f = b.dist > a.dist ? (dd - a.dist) / (b.dist - a.dist) : 0
  const lat = a.lat + (b.lat - a.lat) * f
  const lng = a.lng + (b.lng - a.lng) * f
  // heading from direction of travel
  const dlat = (b.lat - a.lat) * 111000
  const dlng = (b.lng - a.lng) * 71000
  const heading = (Math.atan2(dlng, dlat) * 180 / Math.PI + 360) % 360
  return { lat, lng, heading }
}

// ── Simulator — replays last recorded race via MQTT (Pi scripts only) ───────
const sim = {
  state:     'stopped',
  events:    [],
  cursor:    0,
  startedAt: 0,
  offsetMs:  0,
  timer:     null,

  virtualNow() {
    return this.state === 'playing' ? this.offsetMs + (Date.now() - this.startedAt) : this.offsetMs
  },

  load() {
    // Shell EcoMarathon pulse-and-glide:
    // Pulse-and-glide directly over CSV track points (1m resolution, no interpolation)
    // Engine ON → accelerate 20→38 km/h, Engine OFF → coast 38→20 km/h
    const LAPS     = 7
    const MIN_KMH  = 20
    const MAX_KMH  = 38
    const ACCEL    = 0.8   // m/s²
    const COAST    = 0.25  // m/s²
    const DT       = 0.05  // seconds per tick (50 ms)

    const events   = []
    let ect = 20, fuelTotal = 0
    let lastGpsVt   = -1000
    let lastSpeedVt = -250
    let lastEcuVt   = -200

    let speedMs   = MIN_KMH / 3.6
    let trackIdx  = 0
    let lapsDone  = 0
    let subMeter  = 0     // fractional metres accumulated
    let engineOn  = true
    let ms        = 0

    while (lapsDone < LAPS) {
      // Pulse-and-glide state machine
      if (engineOn) {
        speedMs = Math.min(MAX_KMH / 3.6, speedMs + ACCEL * DT)
        if (speedMs >= MAX_KMH / 3.6) engineOn = false
      } else {
        speedMs = Math.max(MIN_KMH / 3.6, speedMs - COAST * DT)
        if (speedMs <= MIN_KMH / 3.6) engineOn = true
      }

      // Advance through CSV points
      subMeter += speedMs * DT
      while (subMeter >= 1.0) {
        subMeter -= 1.0
        trackIdx++
        if (trackIdx >= TRACK.length) {
          trackIdx = 0
          lapsDone++
          if (lapsDone >= LAPS) break
        }
      }
      if (lapsDone >= LAPS) break

      const kmh = speedMs * 3.6
      const pt  = TRACK[trackIdx]
      const next = TRACK[(trackIdx + 1) % TRACK.length]
      const dlat = (next.lat - pt.lat) * 111000
      const dlng = (next.lng - pt.lng) * 71000
      const heading = (Math.atan2(dlng, dlat) * 180 / Math.PI + 360) % 360

      // gps/position ~1 Hz
      if (ms - lastGpsVt >= 1000) {
        lastGpsVt = ms
        events.push({ vt: ms, topic: 'gps/position', payload: {
          lat: pt.lat, lng: pt.lng,
          speed_kmh: Math.round(kmh * 10) / 10,
          heading,
          ts: new Date(Date.now() + ms).toISOString(),
        }})
      }

      // speed/data ~4 Hz
      if (ms - lastSpeedVt >= 250) {
        lastSpeedVt = ms
        events.push({ vt: ms, topic: 'speed/data', payload: {
          rpm: Math.round(kmh / 0.0894),
          running: engineOn,
        }})
      }

      // ecu/data ~5 Hz
      if (ms - lastEcuVt >= 200) {
        const dt = (ms - lastEcuVt) / 1000
        lastEcuVt = ms
        const rpm       = kmh / 0.0894
        const cycleMs   = engineOn ? (60000 / (rpm / 2)) : Infinity
        const fuelpw    = engineOn ? Math.min(cycleMs, 4.2) : 0
        const dutyCycle = engineOn ? Math.min(1, fuelpw / cycleMs) : 0
        const fuelRate  = engineOn ? 38 * dutyCycle : 0
        fuelTotal += (fuelRate / 60) * dt / 0.75
        ect = Math.min(90, Math.max(18, ect + (engineOn ? 0.06 : -0.025)))
        events.push({ vt: ms, topic: 'ecu/data', payload: {
          RPM:    Math.round(rpm),
          MAP:    engineOn ? Math.round(90 + Math.sin(ms*0.002)*10) : 35,
          TPS:    engineOn ? Math.round((30 + Math.sin(ms*0.003)*15)*10)/10 : 0,
          ECT:    Math.round(ect * 10) / 10,
          IAT:    24,
          O2S:    engineOn ? 0.45 : 0,
          SPARK:  engineOn ? 18 : 0,
          FUELPW1: Math.round(fuelpw * 1000) / 1000,
          FUELPW2: 0,
          UbAdc:  12.4,
          FuelConsumption_g_min: Math.round(fuelRate * 100) / 100,
          FuelTotal_ml: Math.round(fuelTotal * 10) / 10,
          EngineRunning: engineOn,
          StuckCount: 0,
        }})
      }

      ms += 50
    }

    this.events       = events
    this.cursor       = 0
    this.offsetMs     = 0
    this._simEngineOn = false
    this._simLastPos  = null
    console.log(`Sim loaded: ${events.length} events, ${LAPS} laps, ${Math.round(ms/1000)}s`)
  },

  play() {
    if (this.state === 'playing') return
    if (!this.events.length) this.load()
    this.state = 'playing'
    this.startedAt = Date.now()
    this._tick()
  },

  pause() {
    if (this.state !== 'playing') return
    this.offsetMs = this.virtualNow()
    clearTimeout(this.timer)
    this.state = 'paused'
  },

  stop() {
    clearTimeout(this.timer)
    this.state    = 'stopped'
    this.cursor   = 0
    this.offsetMs = 0
    this.events   = []
  },

  _tick() {
    if (this.state !== 'playing') return
    try {
      const now = this.virtualNow()
      while (this.cursor < this.events.length && this.events[this.cursor].vt <= now) {
        const ev = this.events[this.cursor++]
        pub(ev.topic, ev.payload)

        // Track last GPS position published by sim (exact position, no MQTT round-trip lag)
        if (ev.topic === 'gps/position') {
          this._simLastPos = { lat: ev.payload.lat, lng: ev.payload.lng, speed_kmh: ev.payload.speed_kmh }
        }

        // Detect engine transitions directly — place marker at exact GPS position
        if (ev.topic === 'ecu/data' && this._simLastPos) {
          const isOn = ev.payload.EngineRunning === true
          if (isOn !== this._simEngineOn) {
            this._simEngineOn = isOn
            liveEngineEvents.push({ type: isOn ? 'start' : 'stop', ...this._simLastPos, t: Date.now() })
            trimLiveArrays()
          }
        }
      }
      if (this.cursor >= this.events.length) {
        console.log('Simulation complete')
        this.state = 'stopped'
        return
      }
      const next  = this.events[this.cursor]
      const delay = Math.max(4, Math.min(50, next.vt - now))
      this.timer  = setTimeout(() => this._tick(), delay)
    } catch (e) {
      console.error('Sim tick error:', e.message)
      this.timer = setTimeout(() => this._tick(), 100)
    }
  },

  status() {
    return {
      state:       this.state,
      cursor:      this.cursor,
      totalEvents: this.events.length,
      progress:    this.events.length ? this.cursor / this.events.length : 0,
      virtualMs:   this.virtualNow(),
    }
  },

}

// ── Simulator API ──────────────────────────────────────────────────────────
app.get('/api/sim/status', (_req, res) => res.json(sim.status()))

app.post('/api/sim/play', (req, res) => {
  try { sim.play(); res.json(sim.status()) }
  catch (e) { console.error('sim play:', e.message); res.status(500).json({ error: e.message }) }
})

app.post('/api/sim/pause', (_req, res) => { sim.pause(); res.json(sim.status()) })
app.post('/api/sim/stop',  (_req, res) => { sim.stop();  res.json(sim.status()) })

// ── Session store — persisted to disk so reloads keep full race history ───
const SESSION_FILE = join(__dirname, 'session.json')

function loadSessionFromDisk() {
  try {
    if (existsSync(SESSION_FILE))
      return JSON.parse(readFileSync(SESSION_FILE, 'utf8'))
  } catch {}
  return []
}

function saveSessionToDisk() {
  try { writeFileSync(SESSION_FILE, JSON.stringify(sessionLaps), 'utf8') } catch {}
}

let sessionLaps = loadSessionFromDisk()

// ── Live rolling arrays — fed by MQTT subscriber ──────────────────────────
const LIVE_WINDOW_MS = 160_000
const livePositions    = []  // { lat, lng, speed_kmh, t }
const liveEngineEvents = []  // { type, lat, lng, speed_kmh, t }

// Latest state from MQTT — used by /api/state
let latestPosition = null  // { latitude, longitude, speed_kmh, heading, timestamp }
let latestEcuData  = null  // full ecu/data payload
let latestLap      = 0

// Lap tracking from race/current_lap transitions (node-red publishes lap stats to InfluxDB only)
let lapTrack = { lastLap: 0, lastFuelMl: 0, lastTimeMs: 0 }

// Position + engine-event buffers for per-lap trail extraction — kept until session reset
const positionBuffer     = []  // { lat, lng, speed_kmh, t }
const engineEventBuffer  = []  // { type, lat, lng, speed_kmh, t }

function trimLiveArrays() {
  const cutoff = Date.now() - LIVE_WINDOW_MS
  while (livePositions.length    && livePositions[0].t    < cutoff) livePositions.shift()
  while (liveEngineEvents.length && liveEngineEvents[0].t < cutoff) liveEngineEvents.shift()
}

;(function startLiveSubscriber() {
  let lastPos  = null
  let engineOn = false

  const sub = mqtt.connect(MQTT_URL, {
    clientId: `eco-live-${Math.random().toString(16).slice(2,8)}`,
    clean: true, reconnectPeriod: 5000,
    username: MQTT_USER, password: MQTT_PASS,
  })

  sub.on('connect', () => {
    sub.subscribe(['gps/position', 'ecu/data', 'race/laps', 'race/current_lap', 'race/last_lap_stats'], { qos: 0 })
    console.log('Live subscriber connected')
  })

  sub.on('message', (topic, payload) => {
    try {
      const d = JSON.parse(payload.toString())

      if (topic === 'gps/position') {
        const lat       = d.latitude ?? d.lat
        const lng       = d.longitude ?? d.lng
        const speed_kmh = d.speed_kmh ?? d.kmh ?? 0
        const t         = Date.now()
        livePositions.push({ lat, lng, speed_kmh, t })
        positionBuffer.push({ lat, lng, speed_kmh, t })
        lastPos = { lat, lng, speed_kmh }
        latestPosition = {
          latitude:  lat,
          longitude: lng,
          speed_kmh,
          heading:   d.heading ?? 0,
          timestamp: d.timestamp ?? d.ts ?? new Date().toISOString(),
        }
        trimLiveArrays()

      } else if (topic === 'ecu/data') {
        latestEcuData = d
        if (lastPos) {
          // EngineRunning set by the ECU script (handles stuck RPM, thresholds)
          const isOn = d.EngineRunning === true
          if (isOn !== engineOn) {
            engineOn = isOn
            const ev = { type: isOn ? 'start' : 'stop', ...lastPos, t: Date.now() }
            liveEngineEvents.push(ev)
            engineEventBuffer.push(ev)
            trimLiveArrays()
          }
        }

      } else if (topic === 'race/laps') {
        // Accept both node-red raw format {lap, duration, ...} and event-wrapped format
        const raw = d.event ? (d.event === 'lap_complete' || d.event === 'lap' ? d : null) : d
        if (raw && (raw.lap != null || raw.lap_number != null)) {
          const lap = {
            lap:            raw.lap_number ?? raw.lap,
            duration:       raw.duration_seconds ?? raw.duration ?? 0,
            fuel_lap:       raw.fuel_lap       ?? 0,
            fuel_race:      raw.fuel_race      ?? 0,
            distance:       raw.distance       ?? 0,
            speed:          raw.speed          ?? 0,
            lap_ideal_diff: raw.lap_ideal_diff ?? 0,
            projection:     raw.projection     ?? 0,
          }
          const idx = sessionLaps.findIndex(l => l.lap === lap.lap)
          if (idx >= 0) sessionLaps[idx] = lap
          else sessionLaps.push(lap)
          sessionLaps.sort((a, b) => a.lap - b.lap)
          saveSessionToDisk()
        }

      } else if (topic === 'race/current_lap') {
        const n = parseInt(payload.toString(), 10)
        if (!isNaN(n)) latestLap = n

      } else if (topic === 'race/last_lap_stats') {
        // Primary: match by absolute timestamps (works when clocks are in sync)
        const SKEW = 8000
        let trail = d.start && d.end
          ? positionBuffer.filter(p => p.t >= d.start - SKEW && p.t <= d.end + SKEW)
          : []
        // Fallback: node-red and server may be on different machines with different clocks.
        // Use server-side receive time: take the last (duration + 30 s) of buffered positions.
        if (trail.length < 5 && d.duration) {
          const windowMs = (d.duration + 30) * 1000
          const cutoff   = Date.now() - windowMs
          trail = positionBuffer.filter(p => p.t >= cutoff)
        }

        // Extract engine events for this lap using the same dual strategy
        let lapEngineEvents = d.start && d.end
          ? engineEventBuffer.filter(e => e.t >= d.start - SKEW && e.t <= d.end + SKEW)
          : []
        if (lapEngineEvents.length === 0 && d.duration) {
          const windowMs = (d.duration + 30) * 1000
          const cutoff   = Date.now() - windowMs
          lapEngineEvents = engineEventBuffer.filter(e => e.t >= cutoff)
        }

        const lap = {
          lap:            d.lap,
          duration:       d.duration       ?? 0,
          lap_ideal_diff: d.lap_ideal_diff ?? 0,
          start:          d.start          ?? 0,
          end:            d.end            ?? 0,
          fuel_lap:       d.fuel_lap       ?? 0,
          fuel_race:      d.fuel_race      ?? 0,
          distance:       d.distance       ?? 0,
          speed:          d.speed          ?? 0,
          projection:     d.projection     ?? 0,
          trail,
          engineEvents: lapEngineEvents,
        }
        const idx = sessionLaps.findIndex(l => l.lap === lap.lap)
        if (idx >= 0) sessionLaps[idx] = lap
        else sessionLaps.push(lap)
        sessionLaps.sort((a, b) => a.lap - b.lap)
        saveSessionToDisk()
      }
    } catch {}
  })
})()

// ── Live data API ──────────────────────────────────────────────────────────
app.get('/api/live', (_req, res) => {
  trimLiveArrays()
  res.json({ positions: livePositions, engineEvents: liveEngineEvents })
})

// ── State API — latest snapshot from in-memory MQTT state ─────────────────
app.get('/api/state', (_req, res) => {
  res.json({
    position:   latestPosition,
    ecuData:    latestEcuData,
    currentLap: latestLap,
  })
})

// ── Session API ────────────────────────────────────────────────────────────
app.get('/api/session',        (_req, res) => res.json(sessionLaps))
app.post('/api/session/reset', (_req, res) => {
  sessionLaps = []
  positionBuffer.length = 0
  engineEventBuffer.length = 0
  livePositions.length = 0
  liveEngineEvents.length = 0
  saveSessionToDisk()
  res.json({ ok: true })
})

app.get('/api/session/export', (_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="race-${Date.now()}.json"`)
  res.json({ exportedAt: new Date().toISOString(), laps: sessionLaps })
})

app.post('/api/session/import', (req, res) => {
  try {
    const { laps } = req.body
    if (!Array.isArray(laps)) return res.status(400).json({ error: 'Expected { laps: [...] }' })
    sessionLaps = laps
    saveSessionToDisk()
    res.json({ ok: true, count: laps.length })
  } catch (e) { res.status(400).json({ error: e.message }) }
})

// ── Serve built React app ──────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))

app.listen(PORT, () => console.log(`Eco dashboard on port ${PORT}`))
