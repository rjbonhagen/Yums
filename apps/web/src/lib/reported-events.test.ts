import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { loadUpcomingReportedEvents, submitReportedEvent, deleteReportedEvent, validateReportedEvent } from "./reported-events"

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-01T17:00:00Z")) })
afterEach(() => vi.useRealTimers())

function fakeSupabase(result: { data?: unknown; error?: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const chain = {
    from: vi.fn((table: string) => {
      calls.from = [table]
      return chain
    }),
    select: vi.fn((columns: string) => {
      calls.select = [columns]
      return chain
    }),
    insert: vi.fn((row: unknown) => {
      calls.insert = [row]
      return chain
    }),
    delete: vi.fn(() => {
      calls.delete = []
      return chain
    }),
    gte: vi.fn((...args: unknown[]) => {
      calls.gte = args
      return chain
    }),
    lte: vi.fn((...args: unknown[]) => { calls.lte = args; return chain }),
    eq: vi.fn((...args: unknown[]) => {
      calls.eq = [...(calls.eq ?? []), args]
      return chain
    }),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => void) => resolve(result),
  }
  return { supabase: chain, calls }
}

const ROW = {
  id: "report-1",
  user_id: "user-1",
  title: "Free samosas outside Sproul",
  description: "A club is handing out free samosas",
  location_name: "Sproul Plaza",
  latitude: 37.8695,
  longitude: -122.2591,
  start_time: "2026-09-01T18:00:00Z",
  source_url: null,
  created_at: "2026-08-29T10:00:00Z",
  moderation_status: "pending",
}

describe("loadUpcomingReportedEvents", () => {
  it("maps rows and filters to upcoming events via gte(start_time, now)", async () => {
    const { supabase, calls } = fakeSupabase({ data: [ROW], error: null })

    const events = await loadUpcomingReportedEvents(supabase as never)

    expect(events).toEqual([
      {
        id: "report-1",
        userId: "user-1",
        title: "Free samosas outside Sproul",
        description: "A club is handing out free samosas",
        locationName: "Sproul Plaza",
        latitude: 37.8695,
        longitude: -122.2591,
        startTime: "2026-09-01T18:00:00Z",
        sourceUrl: undefined,
        createdAt: "2026-08-29T10:00:00Z",
        moderationStatus: "pending",
      },
    ])
    expect(calls.from).toEqual(["user_reported_events"])
    expect(calls.gte[0]).toBe("start_time")
    expect(calls.lte).toEqual(["start_time", "2026-09-08T17:00:00.000Z"])
  })

  it("throws on a database error", async () => {
    const { supabase } = fakeSupabase({ data: null, error: new Error("permission denied") })
    await expect(loadUpcomingReportedEvents(supabase as never)).rejects.toThrow("permission denied")
  })
})

describe("submitReportedEvent", () => {
  it("inserts scoped to the submitting user with nulls for missing optional fields", async () => {
    const { supabase, calls } = fakeSupabase({ data: ROW, error: null })

    await submitReportedEvent(supabase as never, "user-1", {
      title: "Free samosas outside Sproul",
      startTime: "2026-09-01T18:00:00Z",
    })

    const [insertedRow] = calls.insert as [Record<string, unknown>]
    expect(insertedRow).toMatchObject({
      user_id: "user-1",
      title: "Free samosas outside Sproul",
      start_time: "2026-09-01T18:00:00.000Z",
      description: null,
      location_name: null,
      source_url: null,
      moderation_status: "pending",
    })
  })
})

describe("deleteReportedEvent", () => {
  it("scopes the delete to both the report id and the submitting user", async () => {
    const { supabase, calls } = fakeSupabase({ error: null })
    await deleteReportedEvent(supabase as never, "user-1", "report-1")
    expect(calls.eq).toEqual([
      ["id", "report-1"],
      ["user_id", "user-1"],
    ])
  })
})

describe("report validation", () => {
  const valid = { title: " Free pizza ", startTime: "2026-09-01T18:00:00Z" }
  it("normalizes input and accepts future offers with ordinary source links", () => {
    expect(validateReportedEvent({ ...valid, sourceUrl: " https://example.com/flyer ", locationName: " Sproul " })).toMatchObject({
      title: "Free pizza", startTime: "2026-09-01T18:00:00.000Z", sourceUrl: "https://example.com/flyer", locationName: "Sproul",
    })
  })
  it.each(["javascript:alert(1)", "data:text/html,hello", "/relative", "https://user:password@example.com/"])("rejects unsafe source link %s", (sourceUrl) => {
    expect(() => validateReportedEvent({ ...valid, sourceUrl })).toThrow(/source link/)
  })
  it.each(["invalid", "2026-08-31T18:00:00Z", "2026-09-10T18:00:00Z"])("rejects unusable start time %s", (startTime) => {
    expect(() => validateReportedEvent({ ...valid, startTime })).toThrow(/future event/)
  })
  it("rejects oversized and blank fields before contacting the database", async () => {
    for (const field of [{ title: " " }, { title: "x".repeat(161) }, { description: "x".repeat(2001) }, { locationName: "x".repeat(161) }]) {
      const { supabase } = fakeSupabase({ data: ROW })
      await expect(submitReportedEvent(supabase as never, "user-1", { ...valid, ...field })).rejects.toThrow()
      expect(supabase.from).not.toHaveBeenCalled()
    }
  })
})
