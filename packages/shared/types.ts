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

export interface GroceryProduct {
  id: string
  storeName: string
  name: string
  price: number
  unit?: string
  unitPrice?: number
  proteinGrams?: number
  calories?: number
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

export interface MealPlanStatus {
  mealSwipesRemaining: number
  diningDollarsRemaining: number
  daysLeftInTerm: number
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
  /** Only meaningful for kinds with a real savings figure (free_food). No
   * live source exists for restaurant discount data, so nearby_eats never
   * carries a fabricated number here — see docs/data-sources.md. */
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
  score: number
}
