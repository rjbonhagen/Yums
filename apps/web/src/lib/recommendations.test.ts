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
const callinkSourceMarker = { key: "callink-live" }

vi.mock("@yums/event-ingestion", () => ({
  berkeleyLiveSource: berkeleySourceMarker,
  callinkSource: callinkSourceMarker,
  ingestSource: vi.fn(),
}))

vi.mock("./nearby-places", () => ({
  fetchNearbyPlaces: vi.fn(),
}))

const { ingestSource } = await import("@yums/event-ingestion")
const { fetchNearbyPlaces } = await import("./nearby-places")
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

const liveCallinkEvent = {
  organization: "Orthodox Christian Fellowship",
  title: "Free dinner",
  locationName: "OCF House",
  latitude: 37.87,
  longitude: -122.26,
  startTime: "2026-09-02T01:00:00Z",
  sourceUrl: "https://callink.berkeley.edu/event/1",
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
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe("buildRecommendations", () => {
  it("reports every source as live when all three succeed", async () => {
    mockIngestSource(async (source) =>
      source.key === "berkeley-live" ? [liveBerkeleyEvent] : [liveCallinkEvent],
    )
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([nearbyPlace])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta).toEqual({
      freeFood: { source: "live" },
      callink: { source: "live" },
      nearbyEats: { source: "live" },
      schedule: { source: "placeholder" },
    })
    expect(recommendations.some((r) => r.sourceUrl === liveBerkeleyEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.sourceUrl === liveCallinkEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.title === "Caffé Strada")).toBe(true)
  })

  it("omits Berkeley events during an outage without injecting sample offers", async () => {
    mockIngestSource(async (source) => {
      if (source.key === "berkeley-live") throw new Error("events.berkeley.edu returned 503")
      return [liveCallinkEvent]
    })
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.freeFood).toEqual({ source: "unavailable", error: "events.berkeley.edu returned 503" })
    // Cal Link's independent success is unaffected by Berkeley's failure.
    expect(meta.callink).toEqual({ source: "live" })
    // Some free_food recs came from the (non-empty) mock fixture, not silently zero.
    expect(recommendations.filter((r) => r.kind === "free_food")).toHaveLength(1)
    expect(recommendations.some((r) => r.isSample)).toBe(false)
  })

  it("omits Cal Link events (never fabricates a replacement) when Cal Link fails, without touching Berkeley's result", async () => {
    mockIngestSource(async (source) => {
      if (source.key === "callink-live") throw new Error("callink.berkeley.edu returned 500")
      return [liveBerkeleyEvent]
    })
    vi.mocked(fetchNearbyPlaces).mockResolvedValue([])

    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })

    expect(meta.callink).toEqual({ source: "unavailable", error: "callink.berkeley.edu returned 500" })
    expect(meta.freeFood).toEqual({ source: "live" })
    expect(recommendations.some((r) => r.sourceUrl === liveBerkeleyEvent.sourceUrl)).toBe(true)
    expect(recommendations.some((r) => r.sourceUrl === liveCallinkEvent.sourceUrl)).toBe(false)
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
      source.key === "berkeley-live" ? [liveBerkeleyEvent] : [liveCallinkEvent],
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

    const dinnerRec = recommendations.find((r) => r.sourceUrl === liveCallinkEvent.sourceUrl)!
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
    mockIngestSource(async (source) => source.key === "callink-live" ? [] : [
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
    mockIngestSource(async (source) => source.key === "callink-live" ? [] : [{ ...liveBerkeleyEvent, latitude: 37.9 }])
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
})
