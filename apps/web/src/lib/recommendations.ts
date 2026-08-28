import { scoreOpportunity } from "@campus/shared"
import type { Recommendation } from "@campus/shared"
import { berkeleyLiveSource, ingestSource, type ExtractedFoodEvent } from "@campus/event-ingestion"
import { fetchNearbyPlaces } from "./nearby-places"
import { haversineMinutes } from "./geo"
import { freeFoodEvents as fallbackFreeFoodEvents } from "./mock-data"

const CAMPUS_CENTER = { lat: 37.8719, lng: -122.2585 }
// Roughly covers Berkeley's campus + adjacent neighborhoods (Southside,
// North Berkeley, downtown) — used for both the live events geocoding
// context and the Overpass nearby-places query.
const BBOX: [number, number, number, number] = [37.83, -122.3, 37.9, -122.22]

function proximityScore(minutesAway: number, maxTravelMinutes: number): number {
  return Math.max(0, 1 - minutesAway / Math.max(maxTravelMinutes, 1))
}

interface NormalizedFoodEvent {
  id: string
  title: string
  organization: string
  locationName?: string
  latitude?: number
  longitude?: number
  startTime: string
  sourceUrl: string
  confidenceScore: number
  food?: string
}

function normalizeLiveEvent(e: ExtractedFoodEvent, i: number): NormalizedFoodEvent {
  return {
    id: `live-${i}-${e.sourceUrl}`,
    title: e.title,
    organization: e.organization,
    locationName: e.locationName,
    latitude: e.latitude,
    longitude: e.longitude,
    startTime: e.startTime,
    sourceUrl: e.sourceUrl,
    confidenceScore: e.confidenceScore,
    food: e.food,
  }
}

function normalizeFallbackEvent(e: (typeof fallbackFreeFoodEvents)[number]): NormalizedFoodEvent {
  return {
    id: e.id,
    title: e.title,
    organization: e.organization,
    locationName: e.location.name,
    latitude: e.location.latitude,
    longitude: e.location.longitude,
    startTime: e.startTime,
    sourceUrl: e.sourceUrl,
    confidenceScore: e.confidenceScore,
    food: e.food,
  }
}

export interface RecommendationParams {
  maxTravelMinutes: number
}

export interface RecommendationsMeta {
  freeFood: { source: "live" | "mock-fallback"; error?: string }
  nearbyEats: { source: "live" | "unavailable"; error?: string }
}

export interface RecommendationsResult {
  recommendations: Recommendation[]
  meta: RecommendationsMeta
}

export async function buildRecommendations(params: RecommendationParams): Promise<RecommendationsResult> {
  const { maxTravelMinutes } = params
  const recs: Recommendation[] = []
  const meta: RecommendationsMeta = {
    freeFood: { source: "live" },
    nearbyEats: { source: "live" },
  }

  // Free food and nearby eats hit two unrelated third-party APIs — run
  // them concurrently rather than back-to-back so a slow/timing-out one
  // doesn't double the page's total latency.
  const [foodResult, placesResult] = await Promise.allSettled([
    ingestSource(berkeleyLiveSource),
    fetchNearbyPlaces(BBOX, ["cafe", "restaurant", "fast_food"]),
  ])

  // Free food: live UC Berkeley events calendar, falling back to the
  // hand-written mock only if the live fetch itself fails (network error,
  // upstream down) — not as a default. See docs/data-sources.md.
  let foodEvents: NormalizedFoodEvent[]
  if (foodResult.status === "fulfilled") {
    foodEvents = foodResult.value.map(normalizeLiveEvent)
  } else {
    const err = foodResult.reason
    meta.freeFood = { source: "mock-fallback", error: err instanceof Error ? err.message : "fetch failed" }
    foodEvents = fallbackFreeFoodEvents.map(normalizeFallbackEvent)
  }

  for (const event of foodEvents) {
    const hasCoords = event.latitude != null && event.longitude != null
    const minutesAway = hasCoords
      ? haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, event.latitude!, event.longitude!)
      : undefined
    const estimatedSavings = 8 // typical meal value; no live per-event price source exists

    const score = scoreOpportunity({
      savingsScore: 1, // free food = max savings score
      proximityScore: minutesAway != null ? proximityScore(minutesAway, maxTravelMinutes) : 0.5,
      scheduleScore: 0.7, // placeholder until calendar integration lands
      preferenceScore: 0.6,
      confidenceScore: event.confidenceScore,
    })

    recs.push({
      id: event.id,
      kind: "free_food",
      title: event.food ? `Free ${event.food}` : event.title,
      subtitle: event.locationName ? `${event.organization} · ${event.locationName}` : event.organization,
      estimatedSavings,
      distanceMinutes: minutesAway,
      distanceEstimated: hasCoords ? true : undefined,
      startTime: event.startTime,
      sourceUrl: event.sourceUrl,
      score,
    })
  }

  // Nearby eats: real businesses from OpenStreetMap. No live source exists
  // for student-discount data, so this never claims a savings figure —
  // see the RecommendationKind comment in packages/shared/types.ts.
  if (placesResult.status === "fulfilled") {
    for (const place of placesResult.value) {
      const minutesAway = haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, place.latitude, place.longitude)
      const score = scoreOpportunity({
        savingsScore: 0,
        proximityScore: proximityScore(minutesAway, maxTravelMinutes),
        scheduleScore: 0.5,
        preferenceScore: 0.5,
        confidenceScore: 0.9, // OSM listing exists; not evidence of a current deal
      })

      recs.push({
        id: `place-${place.id}`,
        kind: "nearby_eats",
        title: place.name,
        subtitle: place.address,
        estimatedSavings: 0,
        distanceMinutes: minutesAway,
        distanceEstimated: true,
        score,
      })
    }
  } else {
    const err = placesResult.reason
    meta.nearbyEats = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
  }

  return { recommendations: recs.sort((a, b) => b.score - a.score), meta }
}
