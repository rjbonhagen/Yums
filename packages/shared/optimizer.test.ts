import { describe, expect, it } from "vitest"
import { DEFAULT_WEIGHTS, scoreOpportunity, timeCostPerMinuteFromSlider, totalCost } from "./optimizer"

describe("scoreOpportunity", () => {
  it("returns the weighted sum using DEFAULT_WEIGHTS", () => {
    const score = scoreOpportunity({
      savingsScore: 1,
      proximityScore: 1,
      scheduleScore: 1,
      preferenceScore: 1,
      confidenceScore: 1,
    })
    // All sub-scores at max with default weights summing to 1 → score is 1.
    expect(score).toBeCloseTo(1, 10)
  })

  it("returns 0 when every sub-score is 0", () => {
    const score = scoreOpportunity({
      savingsScore: 0,
      proximityScore: 0,
      scheduleScore: 0,
      preferenceScore: 0,
      confidenceScore: 0,
    })
    expect(score).toBe(0)
  })

  it("weights savings higher than confidence by default", () => {
    const savingsOnly = scoreOpportunity({
      savingsScore: 1,
      proximityScore: 0,
      scheduleScore: 0,
      preferenceScore: 0,
      confidenceScore: 0,
    })
    const confidenceOnly = scoreOpportunity({
      savingsScore: 0,
      proximityScore: 0,
      scheduleScore: 0,
      preferenceScore: 0,
      confidenceScore: 1,
    })
    expect(savingsOnly).toBeGreaterThan(confidenceOnly)
    expect(savingsOnly).toBeCloseTo(DEFAULT_WEIGHTS.savingsWeight, 10)
    expect(confidenceOnly).toBeCloseTo(DEFAULT_WEIGHTS.confidenceWeight, 10)
  })

  it("respects custom weights when provided", () => {
    const score = scoreOpportunity(
      { savingsScore: 1, proximityScore: 0, scheduleScore: 0, preferenceScore: 0, confidenceScore: 0 },
      { savingsWeight: 0.5, proximityWeight: 0, scheduleWeight: 0, preferenceWeight: 0, confidenceWeight: 0 },
    )
    expect(score).toBeCloseTo(0.5, 10)
  })
})

describe("totalCost", () => {
  it("adds costs and subtracts discounts/values", () => {
    const cost = totalCost({
      purchaseCost: 10,
      transportationCost: 2,
      timeCostPerMinute: 0.1,
      travelMinutes: 20,
      inconveniencePenalty: 1,
      discountValue: 3,
      freeFoodValue: 0,
    })
    // 10 + 2 + (0.1*20=2) + 1 - 3 - 0 = 12
    expect(cost).toBeCloseTo(12, 10)
  })

  it("can go negative when free food/discounts outweigh the purchase cost", () => {
    const cost = totalCost({
      purchaseCost: 5,
      transportationCost: 0,
      timeCostPerMinute: 0,
      travelMinutes: 0,
      inconveniencePenalty: 0,
      discountValue: 0,
      freeFoodValue: 8,
    })
    expect(cost).toBeCloseTo(-3, 10)
  })
})

describe("timeCostPerMinuteFromSlider", () => {
  it("maps 0 to 0 and 1 to the ceiling", () => {
    expect(timeCostPerMinuteFromSlider(0)).toBe(0)
    expect(timeCostPerMinuteFromSlider(1)).toBe(0.5)
    expect(timeCostPerMinuteFromSlider(1, 2)).toBe(2)
  })

  it("clamps out-of-range input instead of extrapolating", () => {
    expect(timeCostPerMinuteFromSlider(-1)).toBe(0)
    expect(timeCostPerMinuteFromSlider(2)).toBe(0.5)
  })
})
