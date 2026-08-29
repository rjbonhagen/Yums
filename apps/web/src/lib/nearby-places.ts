// Real businesses near campus from OpenStreetMap's Overpass API — public,
// keyless, community-maintained map data. This replaced a set of made-up
// business names ("Local Poke Shop", "Burrito Corner") that this app used
// to show as fake "student deals." No public source exists for real
// student-discount data (see docs/data-sources.md), so rather than fake
// discount percentages on real places, this is presented honestly as
// "nearby eats" with no savings claim.

// Two independent public Overpass instances — both free community
// infrastructure, so occasional 5xx/timeouts are expected under load. We
// try the primary, then the mirror, before giving up; callers see that as
// a thrown error and degrade gracefully rather than fabricating data.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

async function fetchFromOverpass(url: string, query: string): Promise<OverpassResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Yums/0.1 (student project demo; no production traffic)",
    },
    body: `data=${encodeURIComponent(query)}`,
    // cache:'force-cache' is required for this specific fetch (not just the
    // outer unstable_cache in recommendations.ts) —
    // empirically, a POST request without its own explicit opt-in stayed
    // uncached even inside unstable_cache whenever the calling route was
    // dynamically rendered (searchParams/cookies() elsewhere in the same
    // request), while GET-based sources cached fine with unstable_cache
    // alone. Both layers are needed together for POST. See docs/architecture.md.
    cache: "force-cache",
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return (await res.json()) as OverpassResponse
}

async function postToOverpass(query: string): Promise<OverpassResponse> {
  // Race both mirrors instead of trying them one after another — a slow
  // primary used to add its full 6s timeout before the mirror was even
  // tried, doubling worst-case latency for no benefit.
  const results = await Promise.allSettled(OVERPASS_URLS.map((url) => fetchFromOverpass(url, query)))
  const fulfilled = results.find((r) => r.status === "fulfilled")
  if (fulfilled && fulfilled.status === "fulfilled") return fulfilled.value

  const lastError = results.find((r) => r.status === "rejected")
  throw lastError && lastError.status === "rejected" && lastError.reason instanceof Error
    ? lastError.reason
    : new Error("All Overpass endpoints failed")
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
