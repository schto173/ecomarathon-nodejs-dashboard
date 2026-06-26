import { useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { useRaceStore } from '../store/raceStore'

const BROKER_URL = 'wss://mqtt-ws.tome.lu'
const BROKER_USER = 'eco'
const BROKER_PASS = 'marathon'

const TOPICS = [
  'gps/position',
  'gps/status',
  'ecu/data',
  'speed/data',
  'race/laps',
  'race/current_lap',
  'race/last_lap_stats',
  'race/info_text',
  'config/ideal_lap_time',
  'config/total_laps',
  'config/corners',
  'config/start_line',
  'config/lap_line',
  'config/finish_line',
]

export function useMqtt() {
  const clientRef = useRef(null)
  const store = useRaceStore()

  useEffect(() => {
    const client = mqtt.connect(BROKER_URL, {
      clientId: `eco-strategy-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 3000,
      username: BROKER_USER,
      password: BROKER_PASS,
    })
    clientRef.current = client

    client.on('connect', () => {
      store.setMqttConnected(true)
      client.subscribe(TOPICS, { qos: 1 })
    })

    client.on('disconnect', () => store.setMqttConnected(false))
    client.on('offline', () => store.setMqttConnected(false))
    client.on('error', (err) => {
      console.warn('MQTT error:', err.message)
      store.setMqttConnected(false)
    })

    client.on('message', (topic, payload) => {
      let data
      try {
        data = JSON.parse(payload.toString())
      } catch {
        data = payload.toString()
      }

      switch (topic) {
        case 'gps/position':
          store.setPosition({
            latitude: data.latitude ?? data.lat,
            longitude: data.longitude ?? data.lng,
            altitude: data.altitude,
            speed_kmh: data.speed_kmh ?? data.kmh,
            heading: data.heading,
            timestamp: data.timestamp ?? data.ts ?? new Date().toISOString(),
          })
          break
        case 'gps/status':
          store.setGpsStatus(data)
          break
        case 'ecu/data':
          store.setEcuData(data)
          break
        case 'speed/data':
          store.setSpeedData(data)
          break
        case 'race/laps': {
          // Accept both node-red raw format {lap, duration, ...} and event-wrapped format
          const raw = data.event
            ? (data.event === 'lap_complete' || data.event === 'lap' ? data : null)
            : data
          if (raw && (raw.lap != null || raw.lap_number != null)) {
            store.addLap({
              lap: raw.lap_number ?? raw.lap,
              duration: raw.duration_seconds ?? raw.duration ?? 0,
              fuel_lap: raw.fuel_lap ?? 0,
              fuel_race: raw.fuel_race ?? 0,
              distance: raw.distance ?? 0,
              speed: raw.speed ?? 0,
              projection: raw.projection ?? 0,
              lap_ideal_diff: raw.lap_ideal_diff ?? 0,
            })
          }
          break
        }
        case 'race/current_lap':
          store.setCurrentLap(Number(data) || 0)
          break
        case 'race/last_lap_stats':
          store.addLap({
            lap:            data.lap,
            duration:       data.duration       ?? 0,
            lap_ideal_diff: data.lap_ideal_diff ?? 0,
            fuel_lap:       data.fuel_lap       ?? 0,
            fuel_race:      data.fuel_race      ?? 0,
            distance:       data.distance       ?? 0,
            speed:          data.speed          ?? 0,
            projection:     data.projection     ?? 0,
          })
          break
        case 'race/info_text':
          store.setInfoText(typeof data === 'string' ? data : JSON.stringify(data))
          break
        case 'config/ideal_lap_time':
          store.setIdealLapTime(Number(data))
          break
        case 'config/total_laps':
          store.setTotalLaps(Number(data))
          break
        case 'config/corners':
          store.setCorners(data)
          break
        case 'config/start_line':
          store.setStartLine(data)
          break
        case 'config/lap_line':
          store.setLapLine(data)
          break
        case 'config/finish_line':
          store.setFinishLine(data)
          break
      }
    })

    return () => {
      client.end()
      store.setMqttConnected(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return clientRef
}
