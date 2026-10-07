import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ records: new Map<string, unknown>(), ingest: vi.fn(), places: vi.fn() }))
// Emulate argument-keyed persistence. This verifies the application's
// window selection and outage behavior, not Next's cache implementation.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, keys: string[]) => async (...args: unknown[]) => {
    const key = JSON.stringify([keys, args])
    if (mocks.records.has(key)) return mocks.records.get(key)
    const value = await fn(...args)
    mocks.records.set(key, value)
    return value
  },
}))
vi.mock("@yums/event-ingestion", () => ({
  berkeleyLiveSource: { key: "berkeley-live" }, callinkSource: { key: "callink-live" }, ingestSource: mocks.ingest,
}))
vi.mock("./nearby-places", () => ({ fetchNearbyPlaces: mocks.places }))
import { cacheLiveSource } from "./source-cache"
import { buildRecommendations } from "./recommendations"

beforeEach(() => {
  mocks.records.clear()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-07T18:00:00Z"))
  vi.stubEnv("YUMS_DEMO_MODE", "false")
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe("bounded public-source cache windows", () => {
  it("shares successful reads within the window and refreshes at its boundary", async () => {
    const fetchSource = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("updated")
    const read = cacheLiveSource(fetchSource, "test-source", 120)
    expect(await read()).toBe("first")
    vi.advanceTimersByTime(119999)
    expect(await read()).toBe("first")
    expect(fetchSource).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    expect(await read()).toBe("updated")
    expect(fetchSource).toHaveBeenCalledTimes(2)
  })
  it("does not reuse the last successful window during an outage and can recover", async () => {
    const fetchSource = vi.fn().mockResolvedValueOnce("before outage")
      .mockRejectedValueOnce(new Error("unreachable")).mockResolvedValueOnce("recovered")
    const read = cacheLiveSource(fetchSource, "test-source", 120)
    await read()
    vi.advanceTimersByTime(120000)
    await expect(read()).rejects.toThrow("unreachable")
    expect(await read()).toBe("recovered")
  })
  it("keeps independent source keys and refresh intervals", async () => {
    const fast = vi.fn().mockResolvedValue("events")
    const slow = vi.fn().mockResolvedValue("places")
    const readFast = cacheLiveSource(fast, "events", 120)
    const readSlow = cacheLiveSource(slow, "places", 600)
    expect(await readFast()).toBe("events")
    expect(await readSlow()).toBe("places")
    vi.advanceTimersByTime(120000)
    await readFast()
    await readSlow()
    expect(fast).toHaveBeenCalledTimes(2)
    expect(slow).toHaveBeenCalledOnce()
  })
  it("omits cached source results after their windows expire when the sources fail", async () => {
    mocks.ingest.mockResolvedValue([{
      title: "Free pizza", organization: "Berkeley", sourceUrl: "https://events.berkeley.edu/event/1",
      startTime: "2026-10-07T20:00:00Z", confidenceScore: 0.9,
    }])
    mocks.places.mockResolvedValue([{ id: "1", name: "Real cafe", latitude: 37.87, longitude: -122.26 }])
    const before = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(before.recommendations.length).toBeGreaterThan(0)
    mocks.ingest.mockRejectedValue(new Error("event source outage"))
    mocks.places.mockRejectedValue(new Error("place source outage"))
    vi.advanceTimersByTime(600000)
    const after = await buildRecommendations({ maxTravelMinutes: 20 })
    expect(after.recommendations).toEqual([])
    expect(after.meta.freeFood.source).toBe("unavailable")
    expect(after.meta.callink.source).toBe("unavailable")
    expect(after.meta.nearbyEats.source).toBe("unavailable")
  })
})
