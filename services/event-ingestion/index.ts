import type { CampusEventSource } from "./types"
import { extractDeterministic, type ExtractedFoodEvent } from "./extract"
import { berkeleyLiveSource } from "./sources/berkeley-live"
import { callinkSource } from "./sources/callink-live"
import { normalizeSourceUrl } from "./source-url"
import type { CampusEvent } from "./types"

export * from "./types"
export * from "./extract"
export { berkeleyMockSource } from "./sources/berkeley-mock"
export { berkeleyLiveSource } from "./sources/berkeley-live"
export { callinkSource, CalLinkSignInRequiredError } from "./sources/callink-live"

// Default ingestion is live-only. Sample adapters remain an explicit export
// for test/demo callers and cannot enter an ordinary live ingestion result.
export const sources: CampusEventSource[] = [berkeleyLiveSource, callinkSource]

export async function ingestAll(): Promise<ExtractedFoodEvent[]> {
  const results = await Promise.all(sources.map((s) => s.fetchEvents()))
  return extractValidEvents(results.flat())
}

export async function ingestSource(source: CampusEventSource): Promise<ExtractedFoodEvent[]> {
  const events = await source.fetchEvents()
  return extractValidEvents(events)
}

function extractValidEvents(events: CampusEvent[]): ExtractedFoodEvent[] {
  return events.flatMap((event) => {
    if (!event || typeof event.title !== "string" || !event.title.trim()
      || typeof event.organization !== "string" || !event.organization.trim()
      || typeof event.startTime !== "string" || !Number.isFinite(Date.parse(event.startTime))) return []
    const sourceUrl = normalizeSourceUrl(event.sourceUrl)
    if (!sourceUrl) return []
    const extracted = extractDeterministic({ ...event, sourceUrl })
    return extracted.confidenceScore > 0 ? [extracted] : []
  })
}
