import express from 'express'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import mqtt from 'mqtt'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
const PORT = process.env.PORT || 80

// ── InfluxDB ───────────────────────────────────────────────────────────────
const INFLUX_URL   = 'https://influxdb.tome.lu'
const INFLUX_TOKEN = 'FoFKAJiFX8GWZ6hFLcm79Zhr3vcGBkG8knENHC8f55089vi5Gt4LOTPxJHy2uVKyAxWfp5ilaKpVTqLeOt5Jow=='
const INFLUX_DB    = 'ice'

async function influxQuery(query) {
  const url = `${INFLUX_URL}/query?db=${encodeURIComponent(INFLUX_DB)}&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Authorization: `Token ${INFLUX_TOKEN}` } })
  if (!res.ok) throw new Error(`InfluxDB ${res.status}: ${await res.text()}`)
  return res.json()
}

function seriesRows(data, idx = 0) {
  const series = data.results?.[0]?.series?.[idx]
  if (!series) return []
  const cols = series.columns
  return series.values.map(v => {
    const o = {}; cols.forEach((c, i) => { o[c] = v[i] }); return o
  })
}

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

function positionsToSegments(rows) {
  const segments = []
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i-1], b = rows[i]
    if (a.lat == null || b.lat == null) continue
    const color = speedColor(b.kmh ?? b.speed_kmh)
    const last = segments[segments.length-1]
    if (last && last.color === color) last.positions.push([b.lat, b.lng])
    else segments.push({ color, positions: [[a.lat, a.lng], [b.lat, b.lng]] })
  }
  return segments
}

// ── Track geometry helpers ─────────────────────────────────────────────────
// Derive lap-line (the crossing perpendicular) from the first few positions
function deriveLapLine(positions) {
  // Find first two positions — they define the track direction at lap start
  const pts = positions.filter(p => p.lat && p.lng).slice(0, 8)
  if (pts.length < 2) return null
  // Direction vector (average over first few)
  const dlat = pts[pts.length-1].lat - pts[0].lat
  const dlng = pts[pts.length-1].lng - pts[0].lng
  const len   = Math.sqrt(dlat*dlat + dlng*dlng) || 1
  // Perpendicular: rotate 90°
  const plat =  dlng / len, plng = -dlat / len
  // Scale perpendicular to ~12m on each side
  // At lat 50.53°: 1°lat≈111000m, 1°lng≈70700m
  const scale = 0.00012 / (Math.sqrt((plat*111000)**2 + (plng*70700)**2) / 111000 || 1)
  const cx = pts[0].lat, cy = pts[0].lng
  return [
    [cx + plat * scale * 111000 / 111000, cy + plng * scale * 70700 / 70700],
    [cx - plat * scale * 111000 / 111000, cy - plng * scale * 70700 / 70700],
  ]
}

// Detect corners: positions where heading changes > threshold over a sliding window
function detectCorners(positions, windowSize = 8, threshDeg = 25, minDistM = 80) {
  const corners = []
  let lastCornerIdx = -minDistM

  function heading(a, b) {
    return Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI
  }
  function angleDiff(a, b) {
    let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360; return d
  }
  function distM(a, b) {
    const dlat = (b.lat - a.lat) * 111000
    const dlng = (b.lng - a.lng) * 70700
    return Math.sqrt(dlat*dlat + dlng*dlng)
  }

  for (let i = windowSize; i < positions.length - windowSize; i++) {
    const h1 = heading(positions[i - windowSize], positions[i])
    const h2 = heading(positions[i], positions[i + windowSize])
    const turn = angleDiff(h1, h2)

    // Approximate distance from last corner
    const estDist = (i - lastCornerIdx) * 1.3  // ~1.3m per position at 3 Hz, 65 km/h
    if (Math.abs(turn) > threshDeg && estDist > minDistM) {
      corners.push({ lat: positions[i].lat, lng: positions[i].lng })
      lastCornerIdx = i
    }
  }
  return corners
}

// ── Last race loader ───────────────────────────────────────────────────────
async function loadLastRace() {
  // 1. Fetch all recent laps, exclude pit-stop laps (duration > 600s)
  const lapsData = await influxQuery(
    'SELECT * FROM laps WHERE time > now() - 48h ORDER BY time ASC'
  )
  const allLaps = seriesRows(lapsData).filter(l => l.duration != null && l.duration < 600)

  if (!allLaps.length) throw new Error('No race laps found in last 48 h')

  // 2. Walk backward from end to find where the last race begins (gap > 5 min)
  let raceStart = 0
  for (let i = allLaps.length - 1; i > 0; i--) {
    const gap = (allLaps[i].start - allLaps[i-1].end) / 1000  // seconds
    if (gap > 300) { raceStart = i; break }
  }
  const raceLaps = allLaps.slice(raceStart)
  const t0ms = raceLaps[0].start                      // race start (Unix ms)
  const t1ms = raceLaps[raceLaps.length-1].end + 5000 // a bit after last lap end

  const t0 = new Date(t0ms).toISOString()
  const t1 = new Date(t1ms).toISOString()

  // 3. Fetch positions for the race time window
  const posData = await influxQuery(
    `SELECT lat, lng, speed_kmh, kmh, alt, heading FROM positions_tagged ` +
    `WHERE time >= '${t0}' AND time <= '${t1}' ORDER BY time ASC`
  )
  const positions = seriesRows(posData).filter(p => p.lat && p.lng)

  // 4. Derive ideal lap time from first lap's cumulative diff
  //    ideal = duration - (cumulative_diff / lap_number)   → per-lap ideal constant
  const idealLapTime = Math.round(raceLaps[0].duration - raceLaps[0].lap_ideal_diff)

  // 5. Derive track config from position data
  const lapLine = deriveLapLine(positions)
  const corners = detectCorners(positions)

  return { raceLaps, positions, idealLapTime, lapLine, corners, t0ms, t1ms }
}

// ── MQTT publisher ─────────────────────────────────────────────────────────
const MQTT_URL  = 'wss://mqtt-ws.tome.lu'
const MQTT_USER = 'eco'
const MQTT_PASS = 'marathon'

let mqttPub = null
function getPub() {
  if (mqttPub?.connected) return mqttPub
  mqttPub = mqtt.connect(MQTT_URL, {
    clientId: `eco-srv-${Math.random().toString(16).slice(2,8)}`,
    clean: true, reconnectPeriod: 3000,
    username: MQTT_USER, password: MQTT_PASS,
  })
  mqttPub.on('connect', () => console.log('MQTT publisher connected'))
  mqttPub.on('error',   e  => console.error('MQTT pub error:', e.message))
  return mqttPub
}

function pub(topic, payload) {
  const client = getPub()
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload)
  client.publish(topic, str, { qos: 0, retain: false })
}

// ── Simulator ──────────────────────────────────────────────────────────────
const sim = {
  state:     'stopped',  // 'playing' | 'paused' | 'stopped'
  events:    [],
  cursor:    0,
  startedAt: 0,          // real ms when this play segment began
  offsetMs:  0,          // virtual ms already elapsed before this segment
  timer:     null,

  virtualNow() {
    return this.state === 'playing' ? this.offsetMs + (Date.now() - this.startedAt) : this.offsetMs
  },

  async load() {
    console.log('Loading race data from InfluxDB…')
    const { raceLaps, positions, idealLapTime, lapLine, corners } = await loadLastRace()

    // Publish track config (once on load — client will receive when listening)
    this._config = { raceLaps, idealLapTime, lapLine, corners }

    // Build sorted event timeline
    const t0 = new Date(positions[0].time).getTime()
    const events = []

    // GPS + speed events
    for (const p of positions) {
      const vt = new Date(p.time).getTime() - t0
      const kmh = p.speed_kmh ?? p.kmh ?? 0
      events.push({ vt, topic: 'gps/position', payload: {
        latitude: p.lat, longitude: p.lng,
        altitude: p.alt ?? 0, speed_kmh: kmh,
        heading: p.heading ?? 0, timestamp: p.time,
      }})
      events.push({ vt, topic: 'speed/data', payload: { rpm: kmh / 0.0894 } })
    }

    // Lap change events — detect when lap tag changes in positions
    // (We derive this from laps measurement timing instead)
    let lapIdx = 0
    for (const p of positions) {
      const ms = new Date(p.time).getTime()
      // Check if a lap was completed at this time
      while (lapIdx < raceLaps.length && raceLaps[lapIdx].end <= ms) {
        const lap = raceLaps[lapIdx]
        const vt  = lap.end - (new Date(positions[0].time).getTime())
        events.push({ vt, topic: 'race/laps', payload: {
          event: 'lap_complete',
          lap_number:       lap.lap,
          duration_seconds: lap.duration,
          fuel_lap:         lap.fuel_lap ?? 0,
          fuel_race:        lap.fuel_race ?? 0,
          speed:            lap.speed ?? 0,
          lap_ideal_diff:   lap.lap_ideal_diff ?? 0,
          distance:         lap.distance ?? 0,
          projection:       lap.projection ?? 0,
        }})
        events.push({ vt, topic: 'race/current_lap', payload: String(lap.lap + 1) })
        lapIdx++
      }
    }

    // Synthetic ECU — derived from speed (ECU data too sparse for direct replay)
    let ect = 20, fuelTotal = 0
    let lastEcuVt = -1000
    for (const p of positions) {
      const vt  = new Date(p.time).getTime() - t0
      if (vt - lastEcuVt < 500) continue  // emit ECU at ~2 Hz
      lastEcuVt = vt
      const kmh  = p.speed_kmh ?? p.kmh ?? 0
      const engineOn = kmh >= 26.82
      const fuelRate = engineOn ? 3.8 + Math.sin(vt * 0.001) * 0.6 : 0
      fuelTotal += fuelRate * 0.5 / 60 * (1000 / 750)  // 0.5 s interval
      ect = Math.min(90, Math.max(18, ect + (engineOn ? 0.06 : -0.025)))
      events.push({ vt, topic: 'ecu/data', payload: {
        ECT: Math.round(ect * 10) / 10,
        IAT: 24,
        MAP: engineOn ? 90 + Math.sin(vt*0.002)*10 : 35,
        TPS: engineOn ? 30 + Math.sin(vt*0.003)*15 : 0,
        SPARK: engineOn ? 18 : 0,
        O2S:  engineOn ? 0.45 : 0,
        RPM:  kmh / 0.0894,
        FuelConsumption_g_min: fuelRate,
        FuelTotal_ml: Math.round(fuelTotal * 10) / 10,
        EngineRunning: engineOn,
      }})
    }

    // Engine on/off events — detect RPM threshold crossings
    const ENGINE_RPM = 300
    let prevEngineOn = false
    for (const p of positions) {
      const vt = new Date(p.time).getTime() - t0
      const kmh = p.speed_kmh ?? p.kmh ?? 0
      const isOn = kmh >= 26.82  // RPM 300 threshold, same as client
      if (isOn !== prevEngineOn) {
        events.push({ vt, topic: 'race/engine_event', payload: {
          type: isOn ? 'start' : 'stop',
          lat: p.lat, lng: p.lng,
          speed_kmh: kmh,
          t: new Date(p.time).getTime(),
        }})
        prevEngineOn = isOn
      }
    }

    events.sort((a, b) => a.vt - b.vt)
    this.events = events
    this.cursor = 0
    this.offsetMs = 0
    console.log(`Loaded ${events.length} simulator events spanning ${Math.round((events[events.length-1]?.vt ?? 0)/1000)}s`)
  },

  publishConfig() {
    const { raceLaps, idealLapTime, lapLine, corners } = this._config ?? {}
    if (idealLapTime) pub('config/ideal_lap_time', String(idealLapTime))
    pub('config/total_laps', String(raceLaps?.length ?? 6))
    if (lapLine) {
      pub('config/lap_line',    JSON.stringify(lapLine))
      pub('config/start_line',  JSON.stringify(lapLine))
      pub('config/finish_line', JSON.stringify(lapLine))
    }
    if (corners?.length) pub('config/corners', JSON.stringify(corners))
    pub('race/current_lap', '1')
  },

  async play() {
    if (this.state === 'playing') return
    if (!this.events.length) await this.load()
    this.state     = 'playing'
    this.startedAt = Date.now()
    this.publishConfig()
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
    this.events   = []  // force reload on next play
  },

  _tick() {
    if (this.state !== 'playing') return
    const now = this.virtualNow()

    while (this.cursor < this.events.length && this.events[this.cursor].vt <= now) {
      const ev = this.events[this.cursor++]
      pub(ev.topic, ev.payload)
      // Populate live arrays directly — avoids MQTT round-trip latency
      if (ev.topic === 'race/engine_event' && ev.payload.lat) {
        liveEngineEvents.push({ ...ev.payload, t: Date.now() })
        trimLiveArrays()
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

app.post('/api/sim/play', async (req, res) => {
  try { await sim.play(); res.json(sim.status()) }
  catch (e) { console.error('sim play:', e); res.status(500).json({ error: e.message }) }
})

app.post('/api/sim/pause', (_req, res) => { sim.pause(); res.json(sim.status()) })
app.post('/api/sim/stop',  (_req, res) => { sim.stop();  res.json(sim.status()) })

// ── Laps API — last race only ──────────────────────────────────────────────
app.get('/api/laps', async (req, res) => {
  try {
    const lapsData = await influxQuery(
      'SELECT * FROM laps WHERE time > now() - 48h ORDER BY time ASC'
    )
    const allLaps = seriesRows(lapsData).filter(l => l.duration != null && l.duration < 600)

    // Find last race boundary
    let raceStart = 0
    for (let i = allLaps.length - 1; i > 0; i--) {
      const gap = (allLaps[i].start - allLaps[i-1].end) / 1000
      if (gap > 300) { raceStart = i; break }
    }

    const rows = allLaps.slice(raceStart).map(obj => ({
      lap: obj.lap, duration: obj.duration,
      fuel_lap: obj.fuel_lap ?? 0, fuel_race: obj.fuel_race ?? 0,
      distance: obj.distance ?? 0, speed: obj.speed ?? 0,
      projection: obj.projection ?? 0, lap_ideal_diff: obj.lap_ideal_diff ?? 0,
      time: obj.time,
    }))
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Trail API — current lap, pre-computed segments ─────────────────────────
app.get('/api/trail', async (req, res) => {
  try {
    const posData = await influxQuery(
      'SELECT lat, lng, speed_kmh, kmh FROM positions_tagged WHERE time > now() - 5m ORDER BY time ASC'
    )
    const segments = positionsToSegments(seriesRows(posData))
    res.json({ segments })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── State API — latest snapshot (cached 2 s to avoid hammering InfluxDB) ──
let _stateCache = null
let _stateCacheAt = 0
app.get('/api/state', async (req, res) => {
  try {
    if (_stateCache && Date.now() - _stateCacheAt < 2000) {
      return res.json(_stateCache)
    }
    const [posData, ecuData, lapData] = await Promise.all([
      influxQuery('SELECT LAST(lat) AS lat, LAST(lng) AS lng, LAST(speed_kmh) AS speed_kmh, LAST(kmh) AS kmh, LAST(alt) AS alt FROM positions_tagged'),
      influxQuery('SELECT LAST(ECT) AS ECT, LAST(IAT) AS IAT, LAST(MAP) AS MAP, LAST(TPS) AS TPS, LAST(SPARK) AS SPARK, LAST(O2S) AS O2S, LAST(RPM) AS RPM, LAST(FuelConsumption_g_min) AS FuelConsumption_g_min, LAST(FuelTotal_ml) AS FuelTotal_ml, LAST(EngineRunning) AS EngineRunning FROM ecu'),
      influxQuery('SELECT LAST(lap) AS lap FROM laps WHERE time > now() - 48h AND duration < 600'),
    ])

    const pos = seriesRows(posData)[0] ?? null
    const ecu = seriesRows(ecuData)[0] ?? null
    const lapRow = seriesRows(lapData)[0] ?? null

    _stateCache = {
      position: pos ? { latitude: pos.lat, longitude: pos.lng, speed_kmh: pos.speed_kmh ?? pos.kmh ?? 0, altitude: pos.alt, timestamp: pos.time } : null,
      ecuData:  ecu ? { ECT: ecu.ECT, IAT: ecu.IAT, MAP: ecu.MAP, TPS: ecu.TPS, SPARK: ecu.SPARK, O2S: ecu.O2S, RPM: ecu.RPM, FuelConsumption_g_min: ecu.FuelConsumption_g_min, FuelTotal_ml: ecu.FuelTotal_ml, EngineRunning: ecu.EngineRunning } : null,
      currentLap: lapRow?.lap ?? null,
    }
    _stateCacheAt = Date.now()
    res.json(_stateCache)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Live rolling arrays — fed by MQTT subscriber ──────────────────────────
const LIVE_WINDOW_MS = 160_000
const livePositions    = []  // { lat, lng, speed_kmh, t }
const liveEngineEvents = []  // { type, lat, lng, speed_kmh, t }

function trimLiveArrays() {
  const cutoff = Date.now() - LIVE_WINDOW_MS
  while (livePositions.length    && livePositions[0].t    < cutoff) livePositions.shift()
  while (liveEngineEvents.length && liveEngineEvents[0].t < cutoff) liveEngineEvents.shift()
}

;(function startLiveSubscriber() {
  const ENGINE_RPM = 300
  let lastPos  = null
  let engineOn = false

  const sub = mqtt.connect(MQTT_URL, {
    clientId: `eco-live-${Math.random().toString(16).slice(2,8)}`,
    clean: true, reconnectPeriod: 5000,
    username: MQTT_USER, password: MQTT_PASS,
  })
  sub.on('connect', () => sub.subscribe(['gps/position', 'speed/data'], { qos: 0 }))
  sub.on('message', (topic, payload) => {
    try {
      const d = JSON.parse(payload.toString())
      if (topic === 'gps/position') {
        const lat = d.latitude ?? d.lat
        const lng = d.longitude ?? d.lng
        const speed_kmh = d.speed_kmh ?? d.kmh ?? 0
        const t = Date.now()
        livePositions.push({ lat, lng, speed_kmh, t })
        lastPos = { lat, lng, speed_kmh }
        trimLiveArrays()
      } else if (topic === 'speed/data' && lastPos && sim.state !== 'playing') {
        // Engine detection only for live car — sim injects its own engine events
        const rpm = d.rpm ?? 0
        const isOn = rpm >= ENGINE_RPM
        if (isOn !== engineOn) {
          engineOn = isOn
          const ev = { type: isOn ? 'start' : 'stop', ...lastPos, t: Date.now() }
          liveEngineEvents.push(ev)
          trimLiveArrays()
        }
      }
    } catch {}
  })
})()


// ── Live data API ──────────────────────────────────────────────────────────
app.get('/api/live', (_req, res) => {
  trimLiveArrays()
  res.json({ positions: livePositions, engineEvents: liveEngineEvents })
})

// Serve built React app
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')))

// Warm up MQTT connection on start
getPub()

app.listen(PORT, () => console.log(`Eco dashboard on port ${PORT}`))
