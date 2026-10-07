"use client"

import { useEffect, useRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import type { Recommendation } from "@yums/shared"

const CAMPUS_CENTER: [number, number] = [-122.2585, 37.8719] // [lng, lat]

export type MappablePlace = Pick<Recommendation, "id" | "kind" | "title" | "subtitle" | "latitude" | "longitude">

/**
 * Real coordinates only — every marker here comes from
 * recommendations.ts's latitude/longitude fields, which are themselves
 * either a live event's organizer-entered location or an OpenStreetMap
 * place, never guessed (see packages/shared/types.ts's Recommendation
 * comment). Items without coordinates are filtered out by the caller
 * rather than placed at a fabricated point.
 */
export function FeedMap({ places }: { places: MappablePlace[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !containerRef.current) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: CAMPUS_CENTER,
      zoom: 14,
    })
    mapRef.current = map

    const markers: mapboxgl.Marker[] = []
    for (const place of places) {
      if (place.latitude == null || place.longitude == null) continue
      const color = place.kind === "free_food" ? "#16a34a" : "#2563eb"
      const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(
        `<strong>${escapeHtml(place.title)}</strong>${place.subtitle ? `<br/>${escapeHtml(place.subtitle)}` : ""}`,
      )
      const marker = new mapboxgl.Marker({ color }).setLngLat([place.longitude, place.latitude]).setPopup(popup).addTo(map)
      markers.push(marker)
    }

    return () => {
      markers.forEach((m) => m.remove())
      map.remove()
      mapRef.current = null
    }
  }, [places])

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Map view isn&apos;t available in this demo. Use the list to browse events and places.
      </p>
    )
  }

  return <div ref={containerRef} className="h-96 w-full rounded-lg" />
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}
