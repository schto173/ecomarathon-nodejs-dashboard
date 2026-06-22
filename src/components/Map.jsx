import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import { useRaceStore } from '../store/raceStore'

// Custom car icon
const carIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#FBCE07;border:2px solid #DD1D21;border-radius:50%;box-shadow:0 0 6px #FBCE07aa"></div>`,
  iconAnchor: [7, 7],
})

function PanToPosition({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.panTo([position.latitude, position.longitude], { animate: true, duration: 0.5 })
    }
  }, [position, map])
  return null
}

export default function Map() {
  const { position, positionHistory } = useRaceStore()

  const trail = positionHistory
    .filter((p) => p?.latitude && p?.longitude)
    .map((p) => [p.latitude, p.longitude])

  const defaultCenter = [49.5, 6.1] // Luxembourg default

  return (
    <div className="rounded-xl overflow-hidden border border-gray-800 h-full min-h-[300px]">
      <MapContainer
        center={position ? [position.latitude, position.longitude] : defaultCenter}
        zoom={15}
        style={{ height: '100%', width: '100%', background: '#111' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />

        {trail.length > 1 && (
          <Polyline positions={trail} color="#FBCE07" weight={2} opacity={0.8} />
        )}

        {position?.latitude && position?.longitude && (
          <>
            <Marker
              position={[position.latitude, position.longitude]}
              icon={carIcon}
            />
            <PanToPosition position={position} />
          </>
        )}
      </MapContainer>
    </div>
  )
}
