import { scoreOpportunity } from "@campus/shared"
import type { Recommendation } from "@campus/shared"
import { freeFoodEvents, studentDeals } from "./mock-data"

// Deterministic distance stand-in until real geocoding/routing is wired up:
// derives a rough "minutes away" from lat/lng deltas around campus center.
const CAMPUS_CENTER = { lat: 32.8801, lng: -117.234 }
function estimatedMinutesAway(lat?: number, lng?: number): number {
  if (lat == null || lng == null) return 15
  const dLat = lat - CAMPUS_CENTER.lat
  const dLng = lng - CAMPUS_CENTER.lng
  const roughMiles = Math.sqrt(dLat ** 2 + dLng ** 2) * 69
  return Math.max(1, Math.round(roughMiles * 20)) // ~3 mph walking pace
}

function proximityScore(minutesAway: number, maxTravelMinutes: number): number {
  return Math.max(0, 1 - minutesAway / Math.max(maxTravelMinutes, 1))
}

export interface RecommendationParams {
  maxTravelMinutes: number
}

export function buildRecommendations(params: RecommendationParams): Recommendation[] {
  const { maxTravelMinutes } = params
  const recs: Recommendation[] = []

  for (const event of freeFoodEvents) {
    const minutesAway = estimatedMinutesAway(event.location.latitude, event.location.longitude)
    const estimatedSavings = 8 // typical meal value
    const score = scoreOpportunity({
      savingsScore: 1, // free food = max savings score
      proximityScore: proximityScore(minutesAway, maxTravelMinutes),
      scheduleScore: 0.7, // placeholder until calendar integration lands
      preferenceScore: 0.6,
      confidenceScore: event.confidenceScore,
    })

    recs.push({
      id: event.id,
      kind: "free_food",
      title: event.food ? `Free ${event.food}` : "Free food",
      subtitle: `${event.organization} · ${event.location.name}`,
      estimatedSavings,
      distanceMinutes: minutesAway,
      startTime: event.startTime,
      sourceUrl: event.sourceUrl,
      score,
    })
  }

  for (const deal of studentDeals) {
    const minutesAway = estimatedMinutesAway(deal.latitude, deal.longitude)
    const score = scoreOpportunity({
      savingsScore: Math.min(1, (deal.estimatedSavings ?? 0) / 10),
      proximityScore: proximityScore(minutesAway, maxTravelMinutes),
      scheduleScore: 0.5,
      preferenceScore: 0.5,
      confidenceScore: 0.8,
    })

    recs.push({
      id: deal.id,
      kind: "deal",
      title: deal.description,
      subtitle: deal.businessName,
      estimatedSavings: deal.estimatedSavings ?? 0,
      distanceMinutes: minutesAway,
      startTime: deal.expirationTime,
      sourceUrl: deal.sourceUrl,
      score,
    })
  }

  return recs.sort((a, b) => b.score - a.score)
}
