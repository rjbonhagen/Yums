import { fetchNearbyPlaces, type NearbyPlace } from "./nearby-places"

/**
 * Real store locations near campus (OpenStreetMap, live), matched by name
 * to the chains our reference price catalog covers. Locations are real;
 * the prices attached to them in mock-data.ts are NOT — no public API
 * exposes live retail pricing for any of these chains, so that part stays
 * a manually-maintained reference dataset. See docs/data-sources.md.
 */
export async function fetchRealGroceryStoreLocations(
  bbox: [number, number, number, number],
): Promise<Record<string, NearbyPlace>> {
  const places = await fetchNearbyPlaces(bbox, ["supermarket"])
  const known = ["target", "safeway", "berkeley bowl", "trader joe"]

  const byChain: Record<string, NearbyPlace> = {}
  for (const place of places) {
    const lower = place.name.toLowerCase()
    const match = known.find((k) => lower.includes(k))
    if (match && !byChain[match]) byChain[match] = place
  }
  return byChain
}
