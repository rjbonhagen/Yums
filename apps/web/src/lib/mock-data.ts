// FALLBACK DATA — used only where a live source doesn't exist or fails.
// See docs/data-sources.md for exactly what's live vs. reference-only.

import type { FreeFoodEvent, GroceryProduct } from "@campus/shared"

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

/**
 * Fallback only — recommendations.ts uses this when the live
 * events.berkeley.edu fetch fails (network error, upstream down), not as
 * the default path. See docs/data-sources.md.
 */
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

/**
 * Reference pricing — no public API exposes live retail prices for any of
 * these chains (confirmed: none publish one). Store *locations* are real
 * (fetched live from OpenStreetMap in grocery-stores.ts); these per-item
 * prices are a manually maintained snapshot, not a live feed. See
 * docs/data-sources.md.
 */
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
