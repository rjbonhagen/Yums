// FALLBACK DATA — used only where a live source doesn't exist or fails.
// See docs/data-sources.md for exactly what's live vs. reference-only.

import type { FreeFoodEvent } from "@yums/shared"

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

/** Explicit, opt-in fixtures for a reproducible demo; never an outage fallback. */
export function demoFoodEvents(now = new Date()): FreeFoodEvent[] {
  return freeFoodEvents.map((event, index) => ({
    ...event,
    id: `sample-${event.id}`,
    title: `Sample: ${event.title}`,
    organization: "Sample campus event",
    sourceUrl: "",
    startTime: new Date(now.getTime() + (index + 1) * 90 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + ((index + 1) * 90 + 60) * 60 * 1000).toISOString(),
  }))
}
