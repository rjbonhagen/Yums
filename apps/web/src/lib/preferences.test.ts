import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PREFERENCES, loadLocalPreferences, normalizePreferences, saveLocalPreferences } from "./preferences"

beforeEach(() => {
  localStorage.clear()
  document.cookie = "yums-preferences=; Path=/; Max-Age=0"
})

describe("preference validation and persistence", () => {
  it("rejects nonfinite, negative, out-of-range, and unsupported values", () => {
    expect(normalizePreferences({ budget: "NaN", maxTravelMinutes: -1, transportation: "car", optimizeFor: "healthy" })).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({ budget: Infinity, maxTravelMinutes: 10000 })).toEqual(DEFAULT_PREFERENCES)
    expect(normalizePreferences({ budget: [], maxTravelMinutes: true })).toEqual(DEFAULT_PREFERENCES)
  })
  it("supports zero budget and valid query-string settings", () => {
    expect(normalizePreferences({ budget: "0", maxTravelMinutes: "35", optimizeFor: "fast" })).toEqual({ budget: 0, maxTravelMinutes: 35, optimizeFor: "fast", transportation: "walking" })
  })
  it("persists a cookie for direct server navigation and restores local preferences", () => {
    const prefs = { ...DEFAULT_PREFERENCES, budget: 42, maxTravelMinutes: 8, optimizeFor: "fast" as const }
    saveLocalPreferences(prefs)
    expect(document.cookie).toContain("yums-preferences=")
    expect(loadLocalPreferences()).toEqual(prefs)
    localStorage.clear()
    expect(loadLocalPreferences()).toEqual(prefs)
  })
  it("ignores malformed stored settings", () => {
    localStorage.setItem("yums.preferences", "invalid")
    expect(loadLocalPreferences()).toBeNull()
  })
})
