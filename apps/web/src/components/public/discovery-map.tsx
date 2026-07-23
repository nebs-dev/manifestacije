"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import Link from "next/link"
import { coordsFor, priceLabel, regionName, type CroEvent } from "@/lib/data"

function markerIcon(active: boolean) {
  const fill = active ? "oklch(0.79 0.135 67)" : "oklch(0.38 0.088 256)"
  const scale = active ? "scale(1.15)" : "scale(1)"
  const html = `
    <div style="transform: ${scale}; transform-origin: 50% 100%; transition: transform .15s;">
      <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.6 0 0 7.5 0 16.8 0 29.4 17 44 17 44s17-14.6 17-27.2C34 7.5 26.4 0 17 0Z" fill="${fill}"/>
        <circle cx="17" cy="16.5" r="6" fill="white"/>
      </svg>
    </div>`
  return L.divIcon({
    html,
    className: "cro-marker",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
  })
}

function FlyTo({ event }: { event?: CroEvent }) {
  const map = useMap()
  useEffect(() => {
    if (event) {
      map.flyTo(coordsFor(event), Math.max(map.getZoom(), 11), { duration: 0.8 })
    }
  }, [event, map])
  return null
}

export default function DiscoveryMap({
  events,
  selected,
  onSelect,
}: {
  events: CroEvent[]
  selected?: string
  onSelect: (slug: string) => void
}) {
  const selectedEvent = useMemo(() => events.find((e) => e.slug === selected), [events, selected])

  return (
    <MapContainer
      center={[44.6, 16.0]}
      zoom={7}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "oklch(0.94 0.01 83)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FlyTo event={selectedEvent} />
      {events.map((e) => (
        <Marker
          key={e.slug}
          position={coordsFor(e)}
          icon={markerIcon(e.slug === selected)}
          eventHandlers={{ click: () => onSelect(e.slug) }}
        >
          <Popup>
            <span className="block font-semibold leading-tight">{e.title}</span>
            <span className="block text-xs text-neutral-500">
              {e.city} · {regionName(e.region)}
            </span>
            <span className="mt-1 block text-xs font-medium">{priceLabel(e)}</span>
            <Link href={`/eventi/${e.slug}?from=mapa`} className="mt-1 block text-xs font-semibold text-blue-700 underline">
              Pogledaj detalje
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
