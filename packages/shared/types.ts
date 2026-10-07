// Shared domain types used across apps/services.

export interface University {
  id: string
  name: string
  slug: string
  latitude: number
  longitude: number
}

export interface FreeFoodEvent {
  id: string
  university: string
  organization: string
  title: string
  description?: string

  food?: string

  startTime: string // ISO 8601
  endTime?: string

  location: {
    name: string
    latitude?: number
    longitude?: number
  }

  sourceUrl: string

  confidenceScore: number // 0-1
}

export type DiscountType = "percentage" | "fixed" | "bogo" | "student" | "other"

export interface StudentDeal {
  id: string

  businessName: string
  description: string

  discountType: DiscountType

  estimatedSavings?: number

  latitude?: number
  longitude?: number

  startTime?: string
  expirationTime?: string

  sourceUrl?: string
}

export interface UserPreferences {
  universitySlug: string
  weeklyBudget: number
  dietaryPreferences: string[]
  transportation: "walking" | "bike" | "car" | "transit"
  maxTravelMinutes: number
  optimizeFor: "cheapest" | "healthy" | "high_protein" | "fast" | "custom"
  saveMoneyVsTime: number // 0 (save money) - 1 (save time)
}

export interface RecommendationScoreInput {
  savingsScore: number
  proximityScore: number
  scheduleScore: number
  preferenceScore: number
  confidenceScore: number
}

export interface RecommendationWeights {
  savingsWeight: number
  proximityWeight: number
  scheduleWeight: number
  preferenceWeight: number
  confidenceWeight: number
}

export type RecommendationKind = "free_food" | "nearby_eats" | "grocery" | "dining"

export interface Recommendation {
  id: string
  kind: RecommendationKind
  title: string
  subtitle?: string
  /** Reserved for verified savings values; current discovery sources have
   * no meal replacement or spending data, so recommendations use zero. */
  estimatedSavings: number
  distanceMinutes?: number
  /** true when distanceMinutes is a haversine estimate rather than a
   * routed value; undefined when distance couldn't be computed at all. */
  distanceEstimated?: boolean
  /** Real coordinates from the source (event location or OSM place) — never
   * guessed. Undefined whenever the upstream source didn't provide them
   * (e.g. some Cal Link events have no organizer-entered location); powers
   * /feed's map view. */
  latitude?: number
  longitude?: number
  startTime?: string
  sourceUrl?: string
  endTime?: string
  durationEstimated?: boolean
  /** free_food only: `${organization}::${original event title}` — the
   * *original* title from the source, before any "Free {food}" display
   * transformation, since that transformed title isn't a safe grouping
   * key (two unrelated events can both become "Free pizza"). Lets the UI
   * group exact-duplicate recurring meetings (e.g. a weekly club meeting
   * appearing as 3 separate upcoming instances) without guessing —
   * exact-match only, no fuzzy title similarity. Undefined for
   * nearby_eats, which has no concept of a recurring series. */
  seriesKey?: string
  score: number
}
