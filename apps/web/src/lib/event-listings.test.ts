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
    { sourceUrl: "https://unrelated.example/event/2" },
    { durationEstimated: true },
  ])("keeps distinct dates, venues, organizers, durations and sources separate", (difference) => {
    expect(collapseDuplicateListings([first, { ...second, ...difference }], new Map())).toHaveLength(2)
  })
})

describe("public calendar reposts", () => {
  const campus: Recommendation = { ...first, id: "campus", sourceUrl: "https://events.berkeley.edu/live/events/1",
    subtitle: "UC Berkeley Events Calendar · Mulford Hall", seriesKey: "UC Berkeley Events Calendar::Club kickoff" }
  const graduate: Recommendation = { ...second, id: "graduate", sourceUrl: "https://grad.berkeley.edu/event/club-kickoff/",
    subtitle: "Graduate Assembly · Mulford Hall", seriesKey: "Graduate Assembly::Club kickoff" }
  it("collapses matching titles, venues, and actual start/end times across publishers", () => {
    expect(collapseDuplicateListings([graduate, campus], new Map())).toHaveLength(1)
  })
  it("preserves the saved source and fills richer location details", () => {
    const [result] = collapseDuplicateListings([campus, graduate], new Map([[savedKey(graduate), "saved"]]))
    expect(savedKey(result)).toBe(savedKey(graduate))
    expect(result.distanceMinutes).toBe(7)
    expect(result.sourceUrl).toBe(graduate.sourceUrl)
  })
  it.each([
    { subtitle: "Graduate Assembly · Soda Hall" }, { endTime: "2026-10-15T19:00:00-07:00" },
    { subtitle: "Graduate Assembly" }, { durationEstimated: true }, { title: "Another kickoff" },
  ])("retains distinct or insufficiently identified occurrences", (changes) => {
    expect(collapseDuplicateListings([campus, { ...graduate, ...changes }], new Map())).toHaveLength(2)
  })
  it("keeps known different organizers separate even when a generic repost is present", () => {
    expect(collapseDuplicateListings([campus, graduate, { ...graduate, id: "other", seriesKey: "Other Club::Club kickoff",
      subtitle: "Other Club · Mulford Hall" }], new Map())).toHaveLength(3)
  })
})
