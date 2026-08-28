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
  name: "UC San Diego",
  slug: "ucsd",
}

export const freeFoodEvents: FreeFoodEvent[] = [
  {
    id: "evt-1",
    university: "ucsd",
    organization: "ACM at UCSD",
    title: "ACM General Meeting",
    description: "Weekly meeting with free pizza for all attendees.",
    food: "pizza",
    startTime: at(12, 30),
    endTime: at(13, 30),
    location: { name: "CSE Building, Room 1202", latitude: 32.8815, longitude: -117.2344 },
    sourceUrl: "https://acmucsd.com/events",
    confidenceScore: 0.9,
  },
  {
    id: "evt-2",
    university: "ucsd",
    organization: "Rady School of Management",
    title: "Entrepreneurship Speaker Series",
    description: "Guest speaker talk followed by boba and snacks.",
    food: "boba, snacks",
    startTime: at(16, 0),
    endTime: at(17, 0),
    location: { name: "Rady School, Wells Fargo Hall", latitude: 32.8886, longitude: -117.2361 },
    sourceUrl: "https://rady.ucsd.edu/events",
    confidenceScore: 0.75,
  },
  {
    id: "evt-3",
    university: "ucsd",
    organization: "Residence Hall Government",
    title: "Study Break Social",
    description: "Free boba and coffee, open to all residents.",
    food: "boba, coffee",
    startTime: at(20, 0),
    endTime: at(21, 0),
    location: { name: "Seventh College Commons", latitude: 32.8791, longitude: -117.2384 },
    sourceUrl: "https://housing.ucsd.edu/events",
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
    latitude: 32.8778,
    longitude: -117.2359,
    expirationTime: at(20, 0),
    sourceUrl: "https://example.com/poke-deal",
  },
  {
    id: "deal-2",
    businessName: "Burrito Corner",
    description: "$5 student burrito deal, all day.",
    discountType: "fixed",
    estimatedSavings: 3.0,
    latitude: 32.8802,
    longitude: -117.2371,
    sourceUrl: "https://example.com/burrito-deal",
  },
  {
    id: "deal-3",
    businessName: "Campus Grounds Cafe",
    description: "BOGO coffee, 2-4 PM weekdays.",
    discountType: "bogo",
    estimatedSavings: 3.75,
    latitude: 32.8809,
    longitude: -117.2352,
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
  { id: "g-8", storeName: "Walmart", name: "Eggs (dozen)", price: 2.99, unit: "dozen" },
  { id: "g-9", storeName: "Walmart", name: "Chicken Breast (lb)", price: 3.79, unit: "lb", proteinGrams: 124 },
  { id: "g-10", storeName: "Walmart", name: "Greek Yogurt (32oz)", price: 5.29, unit: "32oz", proteinGrams: 90 },
  { id: "g-11", storeName: "Walmart", name: "Rice (5lb bag)", price: 5.19, unit: "5lb" },
  { id: "g-12", storeName: "Walmart", name: "Rolled Oats (42oz)", price: 3.49, unit: "42oz" },
]

export const mealPlanStatus = {
  mealSwipesRemaining: 18,
  diningDollarsRemaining: 326,
  daysLeftInTerm: 22,
}
