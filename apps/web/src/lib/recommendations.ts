import { unstable_cache } from "next/cache"
import { scoreOpportunity } from "@yums/shared"
import type { Recommendation } from "@yums/shared"
import { berkeleyLiveSource, callinkSource, ingestSource, type ExtractedFoodEvent } from "@yums/event-ingestion"
import { fetchNearbyPlaces } from "./nearby-places"
import { haversineMinutes } from "./geo"
import { freeFoodEvents as fallbackFreeFoodEvents } from "./mock-data"
import { eventEnd, isInCampusWeek } from "./event-time"
import { fetchBusyIntervals, scheduleScoreFromBusyIntervals, type BusyInterval } from "./google-calendar"

const PLACEHOLDER_SCHEDULE_SCORE = 0.7 // used until a calendar is connected (see RecommendationsParams.calendarAccessToken)

const CAMPUS_CENTER = { lat: 37.8719, lng: -122.2585 }
// Roughly covers Berkeley's campus + adjacent neighborhoods (Southside,
// North Berkeley, downtown) — used for both the live events geocoding
// context and the Overpass nearby-places query.
const BBOX: [number, number, number, number] = [37.83, -122.3, 37.9, -122.22]

// /dashboard, /feed, and /api/recommendations all read searchParams and/or
// cookies() (calendar personalization), which are Request-time APIs — once
// a render touches one, Next.js stops honoring per-fetch cache: 'force-cache'
// for that render entirely (verified empirically: identical fetches went
// from ~65ms cached to 2-6s live the moment any Request-time API was read
// in the same request). unstable_cache is Next's documented escape hatch
// for exactly this — it persists a function's result across requests
// independent of whether the calling route is dynamically rendered. These
// three live sources don't depend on the request at all (same data for
// every visitor), so this is a correct, not just fast, use of it.
const getCachedBerkeleyEvents = unstable_cache(() => ingestSource(berkeleyLiveSource), ["berkeley-live-events"], {
  revalidate: 120,
})
const getCachedCallinkEvents = unstable_cache(() => ingestSource(callinkSource), ["callink-events"], {
  revalidate: 120,
})
const getCachedNearbyPlaces = unstable_cache(
  () => fetchNearbyPlaces(BBOX, ["cafe", "restaurant", "fast_food"]),
  ["nearby-places", BBOX.join(",")],
  { revalidate: 600 },
)

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
  endTime?: string
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
    endTime: e.endTime,
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
    endTime: e.endTime,
    sourceUrl: e.sourceUrl,
    confidenceScore: e.confidenceScore,
    food: e.food,
  }
}

export interface RecommendationParams {
  maxTravelMinutes: number
  // Real Google Calendar access token (see /login's "Connect Google
  // Calendar" and apps/web/src/lib/google-calendar.ts). Absent for most
  // callers — scheduleScore then stays the documented flat placeholder.
  calendarAccessToken?: string
}

export interface RecommendationsMeta {
  freeFood: { source: "live" | "mock-fallback"; error?: string }
  callink: { source: "live" | "unavailable"; error?: string }
  nearbyEats: { source: "live" | "unavailable"; error?: string }
  schedule: { source: "live" | "placeholder" | "unavailable"; error?: string }
}

export interface RecommendationsResult {
  recommendations: Recommendation[]
  meta: RecommendationsMeta
}

export async function buildRecommendations(params: RecommendationParams): Promise<RecommendationsResult> {
  const { maxTravelMinutes, calendarAccessToken } = params
  const recs: Recommendation[] = []
  const meta: RecommendationsMeta = {
    freeFood: { source: "live" },
    callink: { source: "live" },
    nearbyEats: { source: "live" },
    schedule: { source: calendarAccessToken ? "live" : "placeholder" },
  }

  // Free food (two independent live sources), Cal Link club events, nearby
  // eats, and (when connected) the user's real calendar all hit unrelated
  // third-party APIs — run them concurrently rather than back-to-back so a
  // slow/timing-out one doesn't add to the others' latency.
  const now = new Date()
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [foodResult, callinkResult, placesResult, calendarResult] = await Promise.allSettled([
    getCachedBerkeleyEvents(),
    getCachedCallinkEvents(),
    getCachedNearbyPlaces(),
    calendarAccessToken
      ? fetchBusyIntervals(calendarAccessToken, now, weekAhead)
      : Promise.resolve<BusyInterval[]>([]),
  ])

  let busyIntervals: BusyInterval[] = []
  if (calendarAccessToken) {
    if (calendarResult.status === "fulfilled") {
      busyIntervals = calendarResult.value
    } else {
      const err = calendarResult.reason
      meta.schedule = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
    }
  }

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

  // Cal Link: real club/org events from callink.berkeley.edu, with real
  // descriptions and an organizer-set "Free Food" benefit tag where
  // present (see services/event-ingestion/sources/callink-live.ts). No
  // mock fallback exists for this source — on failure it simply degrades
  // to "unavailable" with the real error, same as nearbyEats below.
  if (callinkResult.status === "fulfilled") {
    foodEvents = foodEvents.concat(callinkResult.value.map(normalizeLiveEvent))
  } else {
    const err = callinkResult.reason
    meta.callink = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
  }

  for (const event of foodEvents) {
    if (!isInCampusWeek(event.startTime, event.endTime, now)) continue
    const hasCoords = event.latitude != null && event.longitude != null
    const minutesAway = hasCoords
      ? haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, event.latitude!, event.longitude!)
      : undefined
    const estimatedSavings = 8 // typical meal value; no live per-event price source exists

    // Real overlap check against the connected calendar's busy blocks when
    // available; otherwise the documented flat placeholder (see
    // RecommendationParams.calendarAccessToken and lib/google-calendar.ts).
    const eventStart = new Date(event.startTime)
    const end = eventEnd(event.startTime, event.endTime)
    const scheduleScore =
      calendarAccessToken && meta.schedule.source === "live"
        ? scheduleScoreFromBusyIntervals(busyIntervals, eventStart, end.date)
        : PLACEHOLDER_SCHEDULE_SCORE

    const score = scoreOpportunity({
      savingsScore: 1, // free food = max savings score
      proximityScore: minutesAway != null ? proximityScore(minutesAway, maxTravelMinutes) : 0.5,
      scheduleScore,
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
      latitude: event.latitude,
      longitude: event.longitude,
      startTime: event.startTime,
      endTime: end.date.toISOString(),
      durationEstimated: end.estimated,
      sourceUrl: event.sourceUrl,
      // event.title here is the original (pre-"Free {food}"-transform)
      // title — see the Recommendation.seriesKey comment in
      // packages/shared/types.ts for why that distinction matters.
      seriesKey: `${event.organization}::${event.title}`,
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
        latitude: place.latitude,
        longitude: place.longitude,
        score,
      })
    }
  } else {
    const err = placesResult.reason
    meta.nearbyEats = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
  }

  return { recommendations: recs.sort((a, b) => b.score - a.score), meta }
}
