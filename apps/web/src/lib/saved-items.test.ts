import { describe, it, expect, vi } from "vitest"
import type { Recommendation } from "@yums/shared"
import { loadSavedItems, saveRecommendation, unsaveItem } from "./saved-items"

// Minimal fake of supabase-js's chainable query builder — just enough
// surface for these three functions, not a full client. Each method
// records the call and returns `this` so real chaining works; terminal
// methods (order/single/the final eq of a delete) resolve the promise.
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
  id: "rec-1",
  kind: "free_food",
  title: "Free pizza",
  subtitle: "ACM · Soda Hall",
  source_url: "https://events.berkeley.edu/1",
  latitude: 37.87,
  longitude: -122.26,
  start_time: "2026-08-29T18:00:00Z",
}

describe("loadSavedItems", () => {
  it("maps DB rows (snake_case, null) to SavedItem (camelCase, undefined)", async () => {
    const { supabase, calls } = fakeSupabase({ data: [ROW], error: null })

    const items = await loadSavedItems(supabase as never, "user-1")

    expect(items).toEqual([
      {
        id: "rec-1",
        kind: "free_food",
        title: "Free pizza",
        subtitle: "ACM · Soda Hall",
        sourceUrl: "https://events.berkeley.edu/1",
        latitude: 37.87,
        longitude: -122.26,
        startTime: "2026-08-29T18:00:00Z",
      },
    ])
    expect(calls.from).toEqual(["recommendations"])
    expect(calls.eq).toEqual([["user_id", "user-1"]])
  })

  it("converts null optional fields to undefined, not null", async () => {
    const { supabase } = fakeSupabase({
      data: [{ ...ROW, subtitle: null, source_url: null, latitude: null, longitude: null, start_time: null }],
      error: null,
    })

    const [item] = await loadSavedItems(supabase as never, "user-1")

    expect(item.subtitle).toBeUndefined()
    expect(item.sourceUrl).toBeUndefined()
    expect(item.latitude).toBeUndefined()
  })

  it("throws on a database error rather than returning an empty list silently", async () => {
    const { supabase } = fakeSupabase({ data: null, error: new Error("permission denied") })
    await expect(loadSavedItems(supabase as never, "user-1")).rejects.toThrow("permission denied")
  })
})

describe("saveRecommendation", () => {
  const REC: Recommendation = {
    id: "live-0-x",
    kind: "free_food",
    title: "Free pizza",
    subtitle: "ACM · Soda Hall",
    estimatedSavings: 8,
    distanceMinutes: 5,
    startTime: "2026-08-29T18:00:00Z",
    sourceUrl: "https://events.berkeley.edu/1",
    latitude: 37.87,
    longitude: -122.26,
    score: 0.9,
  }

  it("inserts a denormalized snapshot scoped to the signed-in user", async () => {
    const { supabase, calls } = fakeSupabase({ data: ROW, error: null })

    const saved = await saveRecommendation(supabase as never, "user-1", REC)

    expect(saved.id).toBe("rec-1")
    const [insertedRow] = calls.insert as [Record<string, unknown>]
    expect(insertedRow).toMatchObject({
      user_id: "user-1",
      kind: "free_food",
      title: "Free pizza",
      estimated_savings: 8,
      source_url: "https://events.berkeley.edu/1",
    })
  })

  it("stores missing optional fields as null, not undefined", async () => {
    const { supabase, calls } = fakeSupabase({ data: ROW, error: null })
    const nearbyEats: Recommendation = {
      id: "place-1",
      kind: "nearby_eats",
      title: "Caffé Strada",
      estimatedSavings: 0,
      score: 0.5,
    }

    await saveRecommendation(supabase as never, "user-1", nearbyEats)

    const [insertedRow] = calls.insert as [Record<string, unknown>]
    expect(insertedRow.subtitle).toBeNull()
    expect(insertedRow.source_url).toBeNull()
    expect(insertedRow.start_time).toBeNull()
  })
})

describe("unsaveItem", () => {
  it("scopes the delete to both the item id and the signed-in user", async () => {
    const { supabase, calls } = fakeSupabase({ error: null })

    await unsaveItem(supabase as never, "user-1", "rec-1")

    expect(calls.delete).toBeDefined()
    expect(calls.eq).toEqual([
      ["id", "rec-1"],
      ["user_id", "user-1"],
    ])
  })

  it("throws when the delete fails", async () => {
    const { supabase } = fakeSupabase({ error: new Error("network error") })
    await expect(unsaveItem(supabase as never, "user-1", "rec-1")).rejects.toThrow("network error")
  })
})
