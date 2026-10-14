// Real businesses near campus from OpenStreetMap's Overpass API — public,
// keyless, community-maintained map data. This replaced a set of made-up
// business names ("Local Poke Shop", "Burrito Corner") that this app used
// to show as fake "student deals." No public source exists for real
// student-discount data (see docs/data-sources.md), so rather than fake
// discount percentages on real places, this is presented honestly as
// "nearby eats" with no savings claim.

// Two independent public Overpass instances — both free community
// infrastructure, so occasional 5xx/timeouts are expected under load. We
// use the first successful response; callers see a complete outage as
// a thrown error and degrade gracefully rather than fabricating data.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

async function fetchFromOverpass(url: string, query: string, signal: AbortSignal): Promise<OverpassResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Yums/0.1 (UC Berkeley invited pilot)",
    },
    body: `data=${encodeURIComponent(query)}`,
    // Shared caching lives in recommendations.ts; refreshing that cache
    // must reach the source rather than reuse a stale inner fetch cache.
    cache: "no-store",
    signal,
  })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  const body = (await res.json()) as OverpassResponse
  if (!body || !Array.isArray(body.elements)) throw new Error("Invalid OpenStreetMap response")
  return body
}

async function postToOverpass(query: string): Promise<OverpassResponse> {
  const controller = new AbortController()
  try {
    return await Promise.any(OVERPASS_URLS.map((url) => fetchFromOverpass(
      url, query, AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
    )))
  } catch (error) {
    const failure = error instanceof AggregateError ? error.errors.find((reason) => reason instanceof Error) : error
    throw failure instanceof Error ? failure : new Error("All Overpass endpoints failed")
  } finally {
    // Stop the slower request as soon as a valid result arrives.
    controller.abort()
  }
}

export interface NearbyPlace {
  id: string
  name: string
  category: "cafe" | "restaurant" | "fast_food" | "supermarket"
  latitude: number
  longitude: number
  address?: string
}

interface OverpassElement {
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements: OverpassElement[]
}

function toAddress(tags: Record<string, string> | undefined): string | undefined {
  if (!tags) return undefined
  const parts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : undefined
}

/**
 * bbox: [south, west, north, east]. Queries cafes/restaurants/fast_food
 * (and optionally supermarkets) within the box at request time — no
 * caching, always current OSM data.
 */
export async function fetchNearbyPlaces(
  bbox: [number, number, number, number],
  categories: NearbyPlace["category"][] = ["cafe", "restaurant", "fast_food"],
): Promise<NearbyPlace[]> {
  const [south, west, north, east] = bbox
  const box = `${south},${west},${north},${east}`

  const filters: Record<NearbyPlace["category"], string> = {
    cafe: `node["amenity"="cafe"](${box});`,
    restaurant: `node["amenity"="restaurant"](${box});`,
    fast_food: `node["amenity"="fast_food"](${box});`,
    supermarket: `node["shop"="supermarket"](${box});`,
  }

  const query = `[out:json][timeout:20];(${categories.map((c) => filters[c]).join("")});out body 40;`

  const data = await postToOverpass(query)

  return data.elements
    .filter((el) => el.tags?.name)
    .map((el) => ({
      id: String(el.id),
      name: el.tags!.name,
      category: (el.tags!.amenity as NearbyPlace["category"]) ?? "supermarket",
      latitude: el.lat,
      longitude: el.lon,
      address: toAddress(el.tags),
    }))
}
