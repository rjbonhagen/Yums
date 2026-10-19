import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// buildRecommendations()'s entire job is "never fabricate, always disclose
// degradation" (docs/architecture.md) — these tests exercise that guarantee
// directly by controlling which of the three live sources succeed/fail,
// rather than hitting real network.

vi.mock("next/cache", () => ({
  // unstable_cache is only a cross-request persistence layer in a real
  // Next.js server; tests care about buildRecommendations()'s own fallback
  // logic, not caching, so make it a passthrough.
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))

const berkeleySourceMarker = { key: "berkeley-live" }
const graduateSourceMarker = { key: "graduate-live" }

vi.mock("@yums/event-ingestion", async (original) => ({
  ...await original<typeof import("@yums/event-ingestion")>(),
  berkeleyLiveSource: berkeleySourceMarker,
  graduateLiveSource: graduateSourceMarker,
  ingestSource: vi.fn(),
}))

vi.mock("./nearby-places", () => ({
  fetchNearbyPlaces: vi.fn(),
}))
vi.mock("./google-calendar", async (original) => ({
  ...await original<typeof import("./google-calendar")>(), fetchBusyIntervals: vi.fn(),
}))

const { ingestSource } = await import("@yums/event-ingestion")
const { fetchNearbyPlaces } = await import("./nearby-places")
const { fetchBusyIntervals } = await import("./google-calendar")
const { buildRecommendations } = await import("./recommendations")

const liveBerkeleyEvent = {
  organization: "ACM at UC Berkeley",
  title: "Free pizza social",
  locationName: "Soda Hall",
  latitude: 37.8752,
  longitude: -122.2585,
  startTime: "2026-09-01T20:00:00Z",
  sourceUrl: "https://events.berkeley.edu/1",
  confidenceScore: 0.9,
  food: "pizza",
}

const liveGraduateEvent = {
  organization: "Orthodox Christian Fellowship",
  title: "Free dinner",
  locationName: "OCF House",
  latitude: 37.87,
  longitude: -122.26,
  startTime: "2026-09-02T01:00:00Z",
  sourceUrl: "https://grad.berkeley.edu/event/1",
  confidenceScore: 0.9,
  food: "dinner",
}

const nearbyPlace = {
  id: "1",
  name: "Caffé Strada",
  category: "cafe" as const,
  latitude: 37.872,
  longitude: -122.259,
  address: "2300 College Ave",
}

function mockIngestSource(impl: (source: { key: string }) => Promise<unknown[]>) {
  vi.mocked(ingestSource).mockImplementation(impl as never)
}

beforeEach(() => {
  vi.stubEnv("YUMS_DEMO_MODE", "false")
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-01T18:00:00Z"))
  vi.mocked(ingestSource).mockReset()
  vi.mocked(fetchNearbyPlaces).mockReset()
  vi.mocked(fetchBusyIntervals).mockReset()
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe("buildRecommendations", () => {
  it("skips restaurant lookups in the food-only feed and sorts by time", async () => {
    mockIngestSource(async (source) => source.key === "berkeley-live" ? [liveBerkeleyEvent] : [liveGraduateEvent])
    const result = await buildRecommendations({ maxTravelMinutes: 20, freeFoodOnly: true })
    expect(fetchNearbyPlaces).not.toHaveBeenCalled()
    expect(fetchBusyIntervals).not.toHaveBeenCalled()
    expect(result.recommendations.map((event) => event.title)).toEqual([liveBerkeleyEvent.title, liveGraduateEvent.title])
    expect(result.recommendations.every((event) => event.kind === "free_food")).toBe(true)
  })
  it("deduplicates source occurrences, retains recurring dates, and keeps IDs stable across reorder", async () => {
    const nextOccurrence = { ...liveBerkeleyEvent, startTime: "2026-09-02T20:00:00Z" }
    mockIngestSource(async (source) => source.key === "berkeley-live" ? [liveBerkeleyEvent, liveBerkeleyEvent, nextOccurrence] : [])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([nearbyPlace, nearbyPlace])
    const first = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(first.recommendations.filter((r) => r.kind === "free_food")).toHaveLength(2)
    expect(first.recommendations.filter((r) => r.kind === "nearby_eats")).toHaveLength(1)
    mockIngestSource(async (source) => source.key === "berkeley-live" ? [nextOccurrence, liveBerkeleyEvent] : [])
    const second = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(second.recommendations.map((r) => r.id).sort()).toEqual(first.recommendations.map((r) => r.id).sort())
  })
  it("keeps the richer duplicate snapshot and never renders invalid source coordinates", async () => {
    mockIngestSource(async (source) => source.key === "berkeley-live" ? [
      { ...liveBerkeleyEvent, latitude: Infinity, longitude: NaN },
      { ...liveBerkeleyEvent, endTime: "2026-09-01T22:00:00Z" },
      { ...liveGraduateEvent, latitude: 999, longitude: 999 },
    ] : [])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([{ ...nearbyPlace, latitude: NaN }])
    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(recommendations).toHaveLength(2)
    expect(recommendations.find((r) => r.title === liveBerkeleyEvent.title)).toMatchObject({ endTime: "2026-09-01T22:00:00.000Z", durationEstimated: false })
    expect(recommendations.find((r) => r.title === liveGraduateEvent.title)).toMatchObject({ latitude: undefined, longitude: undefined, distanceMinutes: undefined })
    expect(recommendations.every((r) => Number.isFinite(r.score))).toBe(true)
  })
  it("reports every source as live when all three succeed", async () => {
    mockIngestSource(async (source) =>
      source.key === "berkeley-live" ? [liveBerkeleyEvent] : [liveGraduateEvent],
    )
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([nearbyPlace])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta).toEqual({
      freeFood: { source: "live" },
      graduate: { source: "live" },
      nearbyEats: { source: "live" },
      schedule: { source: "placeholder" },
    })
    expect(recommendations.some((r) => r.sourceUrl === liveBerkeleyEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.sourceUrl === liveGraduateEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.title === "Caffé Strada")).toBe(true)
  })

  it("omits Berkeley events during an outage without injecting sample offers", async () => {
    mockIngestSource(async (source) => {
      if (source.key === "berkeley-live") throw new Error("events.berkeley.edu returned 503")
      return [liveGraduateEvent]
    })
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.freeFood).toEqual({ source: "unavailable", error: "events.berkeley.edu returned 503" })
    // Graduate Division's independent success is unaffected by Berkeley's failure.
    expect(meta.graduate).toEqual({ source: "live" })
    // Some free_food recs came from the (non-empty) mock fixture, not silently zero.
    expect(recommendations.filter((r) => r.kind === "free_food")).toHaveLength(1)
    expect(recommendations.some((r) => r.isSample)).toBe(false)
  })

  it("omits Graduate Division events (never fabricates a replacement) when Graduate Division fails, without touching Berkeley's result", async () => {
    mockIngestSource(async (source) => {
      if (source.key === "graduate-live") throw new Error("grad.berkeley.edu returned 500")
      return [liveBerkeleyEvent]
    })
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.graduate).toEqual({ source: "unavailable", error: "grad.berkeley.edu returned 500" })
    expect(meta.freeFood).toEqual({ source: "live" })
    expect(recommendations.some((r) => r.sourceUrl === liveBerkeleyEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.sourceUrl === liveGraduateEvent.sourceUrl)).toBe(false)
  })

  it("checks only the two public calendars without requesting a CalNet session", async () => {
    mockIngestSource(async () => [])
    await buildRecommendations({ maxTravelMinutes: 20, freeFoodOnly: true })
    expect(vi.mocked(ingestSource).mock.calls.map(([source]) => source.key)).toEqual(["berkeley-live", "graduate-live"])
  })

  it("never invents a savings figure for nearby_eats and discloses when Overpass is unavailable", async () => {
    mockIngestSource(async () => [])
    vi.mocked(fetchNearbyPlaces).mockRejectedValue(new Error("The operation was aborted due to timeout"))

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.nearbyEats).toEqual({
      source: "unavailable",
      error: "The operation was aborted due to timeout",
    })
    expect(recommendations.every((r) => r.kind !== "nearby_eats")).toBe(true)
  })

  it("sets seriesKey from the ORIGINAL event title, not the transformed display title", async () => {
    mockIngestSource(async (source) =>
      source.key === "berkeley-live" ? [liveBerkeleyEvent] : [liveGraduateEvent],
    )
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([nearbyPlace])

    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })

    const pizzaRec = recommendations.find((r) => r.sourceUrl === liveBerkeleyEvent.sourceUrl)!
    // Display title is transformed ("Free pizza"), but seriesKey must use
    // the original "Free pizza social" — using the transformed title
    // would risk grouping unrelated events that both happen to serve
    // pizza (see the Recommendation.seriesKey comment in
    // packages/shared/types.ts).
    expect(pizzaRec.title).toBe("Free pizza social")
    expect(pizzaRec.seriesKey).toBe("ACM at UC Berkeley::Free pizza social")

    const dinnerRec = recommendations.find((r) => r.sourceUrl === liveGraduateEvent.sourceUrl)!
    expect(dinnerRec.seriesKey).toBe("Orthodox Christian Fellowship::Free dinner")

    // nearby_eats has no concept of a recurring series.
    const nearbyRec = recommendations.find((r) => r.kind === "nearby_eats")
    expect(nearbyRec).toBeDefined()
    expect(nearbyRec?.seriesKey).toBeUndefined()
  })

  it("gives nearby_eats recommendations zero estimated savings even on success (no fabricated deals)", async () => {
    mockIngestSource(async () => [])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([nearbyPlace])

    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })

    const eats = recommendations.filter((r) => r.kind === "nearby_eats")
    expect(eats.length).toBeGreaterThan(0)
    expect(eats.every((r) => r.estimatedSavings === 0)).toBe(true)
  })

  it("keeps schedule as a placeholder when no calendar token is passed", async () => {
    mockIngestSource(async () => [])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])

    const { meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.schedule).toEqual({ source: "placeholder" })
  })

  it("excludes expired and out-of-week source events and retains real end times", async () => {
    mockIngestSource(async (source) => source.key === "graduate-live" ? [] : [
      { ...liveBerkeleyEvent, endTime: "2026-09-01T22:00:00Z" },
      { ...liveBerkeleyEvent, sourceUrl: "expired", startTime: "2026-09-01T16:00:00Z", endTime: "2026-09-01T17:00:00Z" },
      { ...liveBerkeleyEvent, sourceUrl: "far-future", startTime: "2026-09-20T20:00:00Z" },
    ])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])
    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].endTime).toBe("2026-09-01T22:00:00.000Z")
    expect(recommendations[0].durationEstimated).toBe(false)
  })

  it("changes ordering when the user prioritizes shorter walks", async () => {
    mockIngestSource(async (source) => source.key === "graduate-live" ? [] : [{ ...liveBerkeleyEvent, latitude: 37.9 }])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([{ ...nearbyPlace, latitude: 37.8719, longitude: -122.2585 }])
    const cheap = await buildRecommendations({ maxTravelMinutes: 10, optimizeFor: "cheapest" })
    const fast = await buildRecommendations({ maxTravelMinutes: 10, optimizeFor: "fast" })
    expect(cheap.recommendations[0].kind).toBe("free_food")
    expect(fast.recommendations[0].kind).toBe("nearby_eats")
  })

  it("uses clearly marked sample listings only when demo mode is explicitly enabled", async () => {
    vi.stubEnv("YUMS_DEMO_MODE", "true")
    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(meta.freeFood.source).toBe("demo")
    expect(recommendations).toHaveLength(5)
    expect(recommendations.every((r) => r.isSample)).toBe(true)
    expect(ingestSource).not.toHaveBeenCalled()
    expect(fetchNearbyPlaces).not.toHaveBeenCalled()
  })
  it("uses a source's full duration when checking Calendar conflicts", async () => {
    mockIngestSource(async (source) => source.key === "graduate-live" ? [] : [{ ...liveBerkeleyEvent, endTime: "2026-09-01T22:00:00Z" }])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])
    vi.mocked(fetchBusyIntervals).mockResolvedValue([{ start: "2026-09-01T21:30:00Z", end: "2026-09-01T22:30:00Z" }])
    const conflict = await buildRecommendations({ maxTravelMinutes: 20, calendarAccessToken: "test-token" })
    vi.mocked(fetchBusyIntervals).mockResolvedValue([])
    const available = await buildRecommendations({ maxTravelMinutes: 20, calendarAccessToken: "test-token" })
    expect(conflict.meta.schedule.source).toBe("live")
    expect(conflict.recommendations[0].score).toBeLessThan(available.recommendations[0].score)
  })
  it("discloses Calendar failure without losing discovery results", async () => {
    mockIngestSource(async (source) => source.key === "graduate-live" ? [] : [liveBerkeleyEvent])
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])
    vi.mocked(fetchBusyIntervals).mockRejectedValue(new Error("Calendar unavailable"))
    const result = await buildRecommendations({ maxTravelMinutes: 20, calendarAccessToken: "test-token" })
    expect(result.meta.schedule).toEqual({ source: "unavailable", error: "Calendar unavailable" })
    expect(result.recommendations).toHaveLength(1)
  })
})
