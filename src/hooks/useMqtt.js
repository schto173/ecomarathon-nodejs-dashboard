import { useEffect, useRef } from 'react'
import mqtt from 'mqtt'
import { useRaceStore } from '../store/raceStore'

const BROKER_URL = 'ws://tome.lu:9001'

const TOPICS = [
  'gps/position',
  'gps/status',
  'ecu/data',
  'race/laps',
  'race/current_lap',
  'race/info_text',
  'config/ideal_lap_time',
  'config/total_laps',
]

export function useMqtt() {
  const clientRef = useRef(null)
  const store = useRaceStore()

  useEffect(() => {
    const client = mqtt.connect(BROKER_URL, {
      clientId: `eco-strategy-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 3000,
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
          // Support both naming conventions (old Node-RED uses lat/lng, new Python uses latitude/longitude)
          store.setPosition({
            latitude: data.latitude ?? data.lat,
            longitude: data.longitude ?? data.lng,
            altitude: data.altitude,
            speed_kmh: data.speed_kmh ?? data.kmh,
            heading: data.heading,
            timestamp: data.timestamp ?? new Date().toISOString(),
          })
          break
        case 'gps/status':
          store.setGpsStatus(data)
          break
        case 'ecu/data':
          store.setEcuData(data)
          break
        case 'race/laps':
          if (data.event === 'lap_complete' || data.event === 'lap') {
            store.addLap({
              lap: data.lap_number ?? data.lap,
              duration: data.duration_seconds ?? data.duration,
              fuel_lap: data.fuel_lap ?? 0,
              fuel_race: data.fuel_race ?? 0,
              distance: data.distance ?? 0,
              speed: data.speed ?? 0,
              projection: data.projection ?? 0,
              lap_ideal_diff: data.lap_ideal_diff ?? 0,
            })
          }
          break
        case 'race/current_lap':
          store.setCurrentLap(Number(data) || 0)
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
      }
    })

    return () => {
      client.end()
      store.setMqttConnected(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return clientRef
}
