// MOCK DATA — stands in for live campus event sources, business deal
// feeds, and retailer prices until those integrations are built.
// See docs/data-sources.md for what each source is meant to become.

import type { FreeFoodEvent, GroceryProduct, StudentDeal } from "@campus/shared"

const today = new Date()
function at(hour: number, minute = 0): string {
  const d = new Date(today)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const university = {
  name: "UC Berkeley",
  slug: "berkeley",
}

export const freeFoodEvents: FreeFoodEvent[] = [
  {
    id: "evt-1",
    university: "berkeley",
    organization: "ACM at UC Berkeley",
    title: "ACM General Meeting",
    description: "Weekly meeting with free pizza for all attendees.",
    food: "pizza",
    startTime: at(12, 30),
    endTime: at(13, 30),
    location: { name: "Soda Hall, Wozniak Lounge", latitude: 37.8752, longitude: -122.2585 },
    sourceUrl: "https://acmatberkeley.org/events",
    confidenceScore: 0.9,
  },
  {
    id: "evt-2",
    university: "berkeley",
    organization: "Haas Undergraduate Business Association",
    title: "Entrepreneurship Speaker Series",
    description: "Guest speaker talk followed by boba and snacks.",
    food: "boba, snacks",
    startTime: at(16, 0),
    endTime: at(17, 0),
    location: { name: "Haas School of Business, Spieker Forum", latitude: 37.8698, longitude: -122.2599 },
    sourceUrl: "https://haas.berkeley.edu/events",
    confidenceScore: 0.75,
  },
  {
    id: "evt-3",
    university: "berkeley",
    organization: "Residence Hall Assembly",
    title: "Study Break Social",
    description: "Free boba and coffee, open to all residents.",
    food: "boba, coffee",
    startTime: at(20, 0),
    endTime: at(21, 0),
    location: { name: "Unit 1 Residence Halls Commons", latitude: 37.8683, longitude: -122.2543 },
    sourceUrl: "https://housing.berkeley.edu/events",
    confidenceScore: 0.6,
  },
]

export const studentDeals: StudentDeal[] = [
  {
    id: "deal-1",
    businessName: "Local Poke Shop",
    description: "40% off with student ID, dine-in only.",
    discountType: "student",
    estimatedSavings: 4.5,
    latitude: 37.8683,
    longitude: -122.2585,
    expirationTime: at(20, 0),
    sourceUrl: "https://example.com/poke-deal",
  },
  {
    id: "deal-2",
    businessName: "Burrito Corner",
    description: "$5 student burrito deal, all day.",
    discountType: "fixed",
    estimatedSavings: 3.0,
    latitude: 37.8676,
    longitude: -122.2591,
    sourceUrl: "https://example.com/burrito-deal",
  },
  {
    id: "deal-3",
    businessName: "Telegraph Grounds Cafe",
    description: "BOGO coffee, 2-4 PM weekdays.",
    discountType: "bogo",
    estimatedSavings: 3.75,
    latitude: 37.8671,
    longitude: -122.2588,
    sourceUrl: "https://example.com/cafe-deal",
  },
]

export const groceryProducts: GroceryProduct[] = [
  { id: "g-1", storeName: "Target", name: "Eggs (dozen)", price: 3.49, unit: "dozen" },
  { id: "g-2", storeName: "Target", name: "Greek Yogurt (32oz)", price: 4.99, unit: "32oz", proteinGrams: 90 },
  { id: "g-3", storeName: "Target", name: "Bananas (lb)", price: 0.59, unit: "lb" },
  { id: "g-4", storeName: "Target", name: "Rolled Oats (42oz)", price: 3.29, unit: "42oz" },
  { id: "g-5", storeName: "Safeway", name: "Chicken Breast (lb)", price: 3.99, unit: "lb", proteinGrams: 124 },
  { id: "g-6", storeName: "Safeway", name: "Rice (5lb bag)", price: 5.49, unit: "5lb" },
  { id: "g-7", storeName: "Safeway", name: "Bananas (lb)", price: 0.69, unit: "lb" },
  { id: "g-8", storeName: "Berkeley Bowl", name: "Eggs (dozen)", price: 4.29, unit: "dozen" },
  { id: "g-9", storeName: "Berkeley Bowl", name: "Chicken Breast (lb)", price: 4.49, unit: "lb", proteinGrams: 124 },
  { id: "g-10", storeName: "Berkeley Bowl", name: "Greek Yogurt (32oz)", price: 5.49, unit: "32oz", proteinGrams: 90 },
  { id: "g-11", storeName: "Trader Joe's", name: "Rice (5lb bag)", price: 4.99, unit: "5lb" },
  { id: "g-12", storeName: "Trader Joe's", name: "Rolled Oats (42oz)", price: 2.99, unit: "42oz" },
]

export const mealPlanStatus = {
  mealSwipesRemaining: 18,
  diningDollarsRemaining: 326,
  daysLeftInTerm: 22,
}
