import { describe, expect, it } from "vitest"
import type { Recommendation } from "@yums/shared"
import { collapseDuplicateListings } from "./event-listings"
import { savedKey } from "./save-identity"

const first: Recommendation = { id: "first", kind: "free_food", title: "Club kickoff", seriesKey: "Club::Club kickoff",
  subtitle: "Club · Mulford Hall", startTime: "2026-10-15T17:00:00-07:00", endTime: "2026-10-15T18:30:00-07:00",
  sourceUrl: "https://callink.berkeley.edu/event/1", latitude: 37.87259, longitude: -122.26444,
  distanceMinutes: 7, distanceEstimated: true, estimatedSavings: 0, score: 1 }
const second: Recommendation = { ...first, id: "second", sourceUrl: "https://callink.berkeley.edu/event/2",
  latitude: undefined, longitude: undefined, distanceMinutes: undefined }

describe("duplicate Cal Link listings", () => {
  it("shows one occurrence with its walking estimate", () => {
    expect(collapseDuplicateListings([second, first], new Map())).toEqual([first])
  })
  it("preserves an existing save on either listing and fills missing coordinates", () => {
    const result = collapseDuplicateListings([first, second], new Map([[savedKey(second), "saved-row"]]))
    expect(result).toHaveLength(1)
    expect(savedKey(result[0])).toBe(savedKey(second))
    expect(result[0].distanceMinutes).toBe(7)
    expect(result[0].latitude).toBe(first.latitude)
  })
  it.each([
    { startTime: "2026-10-22T17:00:00-07:00" },
    { subtitle: "Club · Soda Hall" },
    { seriesKey: "Another Club::Club kickoff" },
    { endTime: "2026-10-15T19:30:00-07:00" },
    { latitude: 37.88, longitude: -122.26 },
    { sourceUrl: "https://events.berkeley.edu/event/2" },
  ])("keeps distinct dates, venues, organizers, durations and sources separate", (difference) => {
    expect(collapseDuplicateListings([first, { ...second, ...difference }], new Map())).toHaveLength(2)
  })
})
