import { describe, expect, it } from "vitest"
import { extractDeterministic } from "./extract"
import type { CampusEvent } from "./types"

function event(overrides: Partial<CampusEvent> = {}): CampusEvent {
  return {
    organization: "Test Org",
    title: "Weekly meeting",
    startTime: "2026-09-01T12:00:00Z",
    sourceUrl: "https://example.com",
    ...overrides,
  }
}

describe("extractDeterministic", () => {
  it("gives zero confidence when no food keyword appears at all", () => {
    const result = extractDeterministic(event({ title: "Town hall", description: "Policy discussion" }))
    expect(result.confidenceScore).toBe(0)
    expect(result.food).toBeUndefined()
  })

  it("gives high confidence (0.9) for an explicit 'free food' mention", () => {
    const result = extractDeterministic(event({ title: "General meeting", description: "There will be free food." }))
    expect(result.confidenceScore).toBe(0.9)
  })

  it("gives high confidence (0.9) for an explicit 'free pizza' mention", () => {
    const result = extractDeterministic(event({ title: "Free pizza social" }))
    expect(result.confidenceScore).toBe(0.9)
  })

  it("gives mid confidence (0.75) for a specific food keyword like pizza without 'free'", () => {
    const result = extractDeterministic(event({ description: "Come by for pizza and networking" }))
    expect(result.confidenceScore).toBe(0.75)
  })

  it("gives low confidence (0.5) for a generic food mention", () => {
    const result = extractDeterministic(event({ description: "Food will be provided" }))
    expect(result.confidenceScore).toBe(0.5)
  })

  it("extracts a comma-joined food phrase from known keywords", () => {
    const result = extractDeterministic(event({ description: "Pizza and boba provided" }))
    expect(result.food).toBe("pizza, boba")
  })

  it("only checks title and description, not organization", () => {
    const result = extractDeterministic(event({ organization: "Pizza Club", title: "Meeting", description: "Agenda review" }))
    expect(result.confidenceScore).toBe(0)
  })
})
