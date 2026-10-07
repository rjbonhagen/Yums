import { beforeEach, describe, expect, it } from "vitest"
import { loadGuestSavedItems, saveGuestItem, removeGuestItem } from "./guest-saved-items"
import { savedKey } from "./save-identity"
import type { Recommendation } from "@yums/shared"
const item: Recommendation = { id: "sample-1", kind: "free_food", title: "Free pizza", isSample: true, startTime: "2026-10-07T20:00:00Z", estimatedSavings: 0, score: 1 }
beforeEach(() => localStorage.clear())
describe("browser saves", () => {
  it("deduplicates repeated saves, keeps sample labels, and removes persisted items", () => {
    saveGuestItem(item)
    saveGuestItem({ ...item, startTime: "2026-10-07T20:30:00Z" })
    expect(loadGuestSavedItems()).toHaveLength(1)
    expect(loadGuestSavedItems()[0].isSample).toBe(true)
    removeGuestItem(loadGuestSavedItems()[0].id)
    expect(loadGuestSavedItems()).toEqual([])
  })
  it("distinguishes same-name places and separate event occurrences", () => {
    expect(savedKey({ ...item, isSample: false, sourceUrl: "event/1" })).not.toBe(savedKey({ ...item, isSample: false, sourceUrl: "event/1", startTime: "2026-10-08T20:00:00Z" }))
    expect(savedKey({ ...item, sourceUrl: "osm/1" })).not.toBe(savedKey({ ...item, sourceUrl: "osm/2" }))
  })
  it("survives corrupted browser storage", () => {
    localStorage.setItem("yums.saved-items", "invalid")
    expect(loadGuestSavedItems()).toEqual([])
  })
})
