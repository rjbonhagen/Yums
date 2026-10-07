import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchBusyIntervals, refreshAccessToken, scheduleScoreFromBusyIntervals, type BusyInterval } from "./google-calendar"

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("Calendar response validation", () => {
  it.each([
    {}, { calendars: { primary: { errors: [{ reason: "forbidden" }], busy: [] } } },
    { calendars: { primary: { busy: [{ start: "invalid", end: "invalid" }] } } },
    { calendars: { primary: { busy: [{ start: "2026-10-07T20:00:00Z", end: "2026-10-07T19:00:00Z" }] } } },
  ])("never treats failed or malformed availability as a free calendar", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
    await expect(fetchBusyIntervals("test-token", new Date("2026-10-07T00:00:00Z"), new Date("2026-10-08T00:00:00Z"))).rejects.toThrow(/Calendar/)
  })
  it("accepts an explicitly successful empty busy list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ calendars: { primary: { busy: [] } } }) }))
    expect(await fetchBusyIntervals("test-token", new Date(), new Date())).toEqual([])
  })
  it("rejects malformed token refresh responses before they reach storage", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client")
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: "", expires_in: 3600 }) }))
    await expect(refreshAccessToken("test-refresh")).rejects.toThrow(/invalid credentials/)
  })
})

describe("scheduleScoreFromBusyIntervals", () => {
  it("scores an event high when there's no overlapping busy block", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T18:00:00Z", end: "2026-09-01T19:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("scores an event low when it's fully inside a busy block", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T12:00:00Z", end: "2026-09-01T14:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:30:00Z"),
      new Date("2026-09-01T13:30:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("scores low on a partial overlap (event starts mid-busy-block)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T12:00:00Z", end: "2026-09-01T13:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:30:00Z"),
      new Date("2026-09-01T14:00:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("treats a busy block that ends exactly when the event starts as free (half-open interval)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T11:00:00Z", end: "2026-09-01T12:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("treats a busy block that starts exactly when the event ends as free (half-open interval)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T13:00:00Z", end: "2026-09-01T14:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("checks overlap against every busy interval, not just the first", () => {
    const busy: BusyInterval[] = [
      { start: "2026-09-01T08:00:00Z", end: "2026-09-01T09:00:00Z" },
      { start: "2026-09-01T12:00:00Z", end: "2026-09-01T13:00:00Z" },
    ]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:15:00Z"),
      new Date("2026-09-01T12:45:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("scores high when there are no busy intervals at all", () => {
    const score = scheduleScoreFromBusyIntervals(
      [],
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })
})
