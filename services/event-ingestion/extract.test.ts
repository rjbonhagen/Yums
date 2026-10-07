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

  it("omits food without evidence that it is free", () => {
    const result = extractDeterministic(event({ description: "Come by for pizza and networking" }))
    expect(result.confidenceScore).toBe(0)
  })

  it("gives low confidence (0.5) for a generic food mention", () => {
    const result = extractDeterministic(event({ description: "Food will be provided" }))
    expect(result.confidenceScore).toBe(0)
  })

  it("extracts a comma-joined food phrase from known keywords", () => {
    const result = extractDeterministic(event({ description: "Free pizza and boba provided" }))
    expect(result.food).toBe("pizza, boba")
  })

  it.each([
    "Pizza costs $5", "Free admission, pizza costs $5", "No free food today",
    "Food is not free", "There won't be free pizza", "Gluten-free pizza social",
    "Discussion about free food policy", "Free food with purchase",
    "Coffee tasting", "Lunch seminar about food insecurity", "Not a free lunch", "Free pizza canceled",
  ])("does not advertise an ambiguous or paid offer: %s", (description) => {
    expect(extractDeterministic(event({ description })).confidenceScore).toBe(0)
  })

  it.each(["Complimentary refreshments provided", "Lunch is free", "Free boba after the meeting"])("accepts an explicit offer: %s", (description) => {
    expect(extractDeterministic(event({ description })).confidenceScore).toBe(0.9)
  })

  it("accepts an explicit organizer benefit without inventing a food type", () => {
    const result = extractDeterministic(event({ freeFoodConfirmed: true }))
    expect(result.confidenceScore).toBe(0.9)
    expect(result.food).toBeUndefined()
  })
  it("rejects withdrawn offers even if the original benefit tag remains", () => {
    expect(extractDeterministic(event({ freeFoodConfirmed: true, description: "No free food today." })).confidenceScore).toBe(0)
  })

  it("only checks title and description, not organization", () => {
    const result = extractDeterministic(event({ organization: "Pizza Club", title: "Meeting", description: "Agenda review" }))
    expect(result.confidenceScore).toBe(0)
  })
})
