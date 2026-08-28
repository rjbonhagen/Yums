import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { haversineMinutes, walkingMinutesBetween } from "./geo"

describe("haversineMinutes", () => {
  it("returns 0 (clamped to a minimum of 1) between the same point", () => {
    expect(haversineMinutes(37.8719, -122.2585, 37.8719, -122.2585)).toBe(1)
  })

  it("computes a real-world walking estimate at ~3mph between two known points", () => {
    // Sather Gate to Berkeley Bowl West — roughly 2.4 miles by straight line.
    const minutes = haversineMinutes(37.8703, -122.2595, 37.8489, -122.2947)
    // 2.4mi / 3mph * 60 ≈ 48min; allow a wide-ish band since this is a
    // sanity check on the formula, not a precise fixture.
    expect(minutes).toBeGreaterThan(30)
    expect(minutes).toBeLessThan(65)
  })

  it("is symmetric (order of points doesn't matter)", () => {
    const a = haversineMinutes(37.87, -122.26, 37.85, -122.29)
    const b = haversineMinutes(37.85, -122.29, 37.87, -122.26)
    expect(a).toBe(b)
  })

  it("never returns less than 1 minute even for a tiny distance", () => {
    expect(haversineMinutes(37.8719, -122.2585, 37.87191, -122.25851)).toBe(1)
  })
})

describe("walkingMinutesBetween", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns a real routed duration (not estimated) when OSRM succeeds", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ duration: 600 }] }), // 600s = 10min
    } as Response)

    const result = await walkingMinutesBetween(37.87, -122.26, 37.85, -122.29)
    expect(result).toEqual({ minutes: 10, estimated: false })
  })

  it("falls back to the haversine estimate (and discloses it) when OSRM fails", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network error"))

    const result = await walkingMinutesBetween(37.8719, -122.2585, 37.8719, -122.2585)
    expect(result.estimated).toBe(true)
    expect(result.minutes).toBe(haversineMinutes(37.8719, -122.2585, 37.8719, -122.2585))
  })

  it("falls back to the estimate when OSRM returns a non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await walkingMinutesBetween(37.87, -122.26, 37.85, -122.29)
    expect(result.estimated).toBe(true)
  })

  it("falls back to the estimate when OSRM's response has no usable route", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    } as Response)

    const result = await walkingMinutesBetween(37.87, -122.26, 37.85, -122.29)
    expect(result.estimated).toBe(true)
  })
})
