export interface CampusEvent {
  organization: string
  title: string
  description?: string
  startTime: string // ISO 8601
  endTime?: string
  locationName?: string
  latitude?: number
  longitude?: number
  sourceUrl: string
  freeFoodConfirmed?: boolean // Explicit organizer-set Free Food benefit.
}

export interface CampusEventSource {
  key: string
  fetchEvents(): Promise<CampusEvent[]>
}

const FOOD_KEYWORDS = [
  "food",
  "pizza",
  "lunch",
  "dinner",
  "snacks",
  "refreshments",
  "boba",
  "coffee",
  "catering",
  "free food",
  "breakfast",
]

/**
 * Cheap keyword pre-filter before handing descriptions to the LLM extractor.
 * Keeps API cost down: most calendar events don't mention food at all.
 */
export function mentionsFood(event: Pick<CampusEvent, "title" | "description">): boolean {
  const haystack = `${event.title} ${event.description ?? ""}`.toLowerCase()
  return FOOD_KEYWORDS.some((kw) => haystack.includes(kw))
}
