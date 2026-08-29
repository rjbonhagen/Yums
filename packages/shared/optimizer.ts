// Deterministic scoring math (no LLM). Kept framework-free so it can run
// in the Next.js app, an API route, or a standalone service.

import type { RecommendationScoreInput, RecommendationWeights } from "./types"

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  savingsWeight: 0.35,
  proximityWeight: 0.25,
  scheduleWeight: 0.2,
  preferenceWeight: 0.1,
  confidenceWeight: 0.1,
}

export function scoreOpportunity(
  input: RecommendationScoreInput,
  weights: RecommendationWeights = DEFAULT_WEIGHTS,
): number {
  return (
    input.savingsScore * weights.savingsWeight +
    input.proximityScore * weights.proximityWeight +
    input.scheduleScore * weights.scheduleWeight +
    input.preferenceScore * weights.preferenceWeight +
    input.confidenceScore * weights.confidenceWeight
  )
}

// TOTAL COST = purchase cost + transportation cost + time cost
//              + inconvenience penalty - discount value - free-food value
export interface TotalCostInput {
  purchaseCost: number
  transportationCost: number
  timeCostPerMinute: number
  travelMinutes: number
  inconveniencePenalty: number
  discountValue: number
  freeFoodValue: number
}

export function totalCost(input: TotalCostInput): number {
  const timeCost = input.timeCostPerMinute * input.travelMinutes
  return (
    input.purchaseCost +
    input.transportationCost +
    timeCost +
    input.inconveniencePenalty -
    input.discountValue -
    input.freeFoodValue
  )
}

// Maps a 0 (save money) - 1 (save time) slider to a time cost per minute
// used in totalCost(). Tune the ceiling as real usage data comes in.
export function timeCostPerMinuteFromSlider(saveMoneyVsTime: number, ceiling = 0.5): number {
  const clamped = Math.min(1, Math.max(0, saveMoneyVsTime))
  return clamped * ceiling
}
