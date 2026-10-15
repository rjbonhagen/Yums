import { cacheLiveSource } from "./source-cache"
import { scoreOpportunity, DEFAULT_WEIGHTS } from "@yums/shared"
import type { Recommendation } from "@yums/shared"
import { berkeleyLiveSource, callinkSource, ingestSource, type ExtractedFoodEvent } from "@yums/event-ingestion"
import { fetchNearbyPlaces } from "./nearby-places"
import { haversineMinutes, validCoordinates } from "./geo"
import { demoFoodEvents } from "./mock-data"
import { eventEnd, isInCampusWeek } from "./event-time"
import { fetchBusyIntervals, scheduleScoreFromBusyIntervals, type BusyInterval } from "./google-calendar"

const PLACEHOLDER_SCHEDULE_SCORE = 0.7 // used until a calendar is connected (see RecommendationsParams.calendarAccessToken)

const CAMPUS_CENTER = { lat: 37.8719, lng: -122.2585 }
// Roughly covers Berkeley's campus + adjacent neighborhoods (Southside,
// North Berkeley, downtown) — used for both the live events geocoding
// context and the Overpass nearby-places query.
const BBOX: [number, number, number, number] = [37.83, -122.3, 37.9, -122.22]

// Shared public sources have bounded cache windows. Each new window needs
// a successful network response; a failed refresh cannot retain old results
// indefinitely. Account preferences and Calendar tokens are never cached here.
const getCachedBerkeleyEvents = cacheLiveSource(() => ingestSource(berkeleyLiveSource), "berkeley-live-events", 120)
const getCachedCallinkEvents = cacheLiveSource(() => ingestSource(callinkSource), "callink-events", 120)
const getCachedNearbyPlaces = cacheLiveSource(
  () => fetchNearbyPlaces(BBOX, ["cafe", "restaurant", "fast_food"]),
  `nearby-places:${BBOX.join(",")}`, 600,
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

function normalizeLiveEvent(e: ExtractedFoodEvent): NormalizedFoodEvent {
  return {
    id: `live-${e.sourceUrl}-${Date.parse(e.startTime)}`,
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

function normalizeFallbackEvent(e: ReturnType<typeof demoFoodEvents>[number]): NormalizedFoodEvent {
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
  freeFoodOnly?: boolean
  optimizeFor?: "cheapest" | "fast"
  // Real Google Calendar access token (see /login's "Connect Google
  // Calendar" and apps/web/src/lib/google-calendar.ts). Absent for most
  // callers — scheduleScore then stays the documented flat placeholder.
  calendarAccessToken?: string
}

export interface RecommendationsMeta {
  freeFood: { source: "live" | "unavailable" | "demo"; error?: string }
  callink: { source: "live" | "unavailable" | "demo"; error?: string }
  nearbyEats: { source: "live" | "unavailable" | "demo"; error?: string }
  schedule: { source: "live" | "placeholder" | "unavailable"; error?: string }
}

export interface RecommendationsResult {
  recommendations: Recommendation[]
  meta: RecommendationsMeta
}

export async function buildRecommendations(params: RecommendationParams): Promise<RecommendationsResult> {
  const { maxTravelMinutes, calendarAccessToken } = params
  const weights = params.optimizeFor === "fast" ? { ...DEFAULT_WEIGHTS, savingsWeight: 0.1, proximityWeight: 0.5 } : DEFAULT_WEIGHTS
  const demo = process.env.YUMS_DEMO_MODE === "true"
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
    demo ? Promise.resolve([]) : getCachedBerkeleyEvents(),
    demo ? Promise.resolve([]) : getCachedCallinkEvents(),
    params.freeFoodOnly ? Promise.resolve([]) : demo ? Promise.resolve([
      { id: "sample-cafe", name: "Sample campus cafe", latitude: 37.8705, longitude: -122.259, address: "Sample listing · no verified prices" },
      { id: "sample-restaurant", name: "Sample nearby restaurant", latitude: 37.869, longitude: -122.26, address: "Sample listing · no verified prices" },
    ]) : getCachedNearbyPlaces(),
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

  // Source failures are disclosed and never replaced by synthetic offers.
  let foodEvents: NormalizedFoodEvent[]
  if (foodResult.status === "fulfilled") {
    foodEvents = foodResult.value.map(normalizeLiveEvent)
  } else {
    const err = foodResult.reason
    meta.freeFood = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
    foodEvents = []
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

  if (demo) {
    foodEvents = demoFoodEvents(now).map(normalizeFallbackEvent)
    meta.freeFood = { source: "demo" }
    meta.callink = { source: "demo" }
    meta.nearbyEats = { source: "demo" }
  }

  // Source order can change between refreshes. Identity is the source URL
  // plus occurrence time, so repeated pages collapse but recurring dates stay.
  const uniqueFood = new Map<string, NormalizedFoodEvent>()
  const quality = (event: NormalizedFoodEvent) => Number(!eventEnd(event.startTime, event.endTime).estimated)
    + Number(validCoordinates(event.latitude, event.longitude)) + Number(Boolean(event.locationName))
  for (const event of foodEvents) {
    const previous = uniqueFood.get(event.id)
    if (!previous || quality(event) > quality(previous)) uniqueFood.set(event.id, event)
  }
  for (const event of uniqueFood.values()) {
    if (!isInCampusWeek(event.startTime, event.endTime, now)) continue
    const hasCoords = validCoordinates(event.latitude, event.longitude)
    const minutesAway = hasCoords
      ? haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, event.latitude!, event.longitude!)
      : undefined
    const estimatedSavings = 0 // No verified meal replacement value or actual spending data.

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
    }, weights)

    recs.push({
      id: event.id,
      kind: "free_food",
      isSample: demo,
      title: event.title,
      subtitle: event.locationName ? `${event.organization} · ${event.locationName}` : event.organization,
      estimatedSavings,
      distanceMinutes: minutesAway,
      distanceEstimated: hasCoords ? true : undefined,
      latitude: hasCoords ? event.latitude : undefined,
      longitude: hasCoords ? event.longitude : undefined,
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
    const seenPlaces = new Set<string>()
    for (const place of placesResult.value) {
      if (!validCoordinates(place.latitude, place.longitude) || seenPlaces.has(place.id)) continue
      seenPlaces.add(place.id)
      const minutesAway = haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, place.latitude, place.longitude)
      const score = scoreOpportunity({
        savingsScore: 0,
        proximityScore: proximityScore(minutesAway, maxTravelMinutes),
        scheduleScore: 0.5,
        preferenceScore: 0.5,
        confidenceScore: 0.9, // OSM listing exists; not evidence of a current deal
      }, weights)

      recs.push({
        id: `place-${place.id}`,
        kind: "nearby_eats",
        isSample: demo,
        title: place.name,
        subtitle: place.address,
        estimatedSavings: 0,
        distanceMinutes: minutesAway,
        distanceEstimated: true,
        latitude: place.latitude,
        longitude: place.longitude,
        sourceUrl: demo ? undefined : `https://www.openstreetmap.org/node/${place.id}`,
        score,
      })
    }
  } else {
    const err = placesResult.reason
    meta.nearbyEats = { source: "unavailable", error: err instanceof Error ? err.message : "fetch failed" }
  }

  return { recommendations: recs.sort(params.freeFoodOnly
    ? (a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!)
    : (a, b) => b.score - a.score), meta }
}
