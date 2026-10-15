// Real, keyless, public routing/geo services. No API key required for
// either — both are public demo/community infrastructure, fine for this
// project's request volume but not meant for production-scale traffic
// (see their usage policies if this ever needs to scale).

const OSRM_URL = "https://router.project-osrm.org/route/v1/foot"

export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === "number" && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === "number" && Number.isFinite(longitude) && Math.abs(longitude) <= 180
}

export function haversineMinutes(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8 // miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  const miles = 2 * R * Math.asin(Math.sqrt(h))
  return Math.max(1, Math.round((miles / 3) * 60)) // ~3 mph walking pace
}

/**
 * Real walking time between two points via the public OSRM demo router.
 * Falls back to a haversine-distance estimate (same 3mph assumption OSRM
 * would roughly produce anyway) if the demo server is slow/unreachable —
 * that fallback is disclosed to callers via the `estimated` flag rather
 * than silently pretending it's routed.
 */
export async function walkingMinutesBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): Promise<{ minutes: number; estimated: boolean }> {
  try {
    const res = await fetch(`${OSRM_URL}/${aLng},${aLat};${bLng},${bLat}?overview=false`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json()
    const seconds = data?.routes?.[0]?.duration
    if (typeof seconds !== "number") throw new Error("OSRM: no route")
    return { minutes: Math.max(1, Math.round(seconds / 60)), estimated: false }
  } catch {
    return { minutes: haversineMinutes(aLat, aLng, bLat, bLng), estimated: true }
  }
}
