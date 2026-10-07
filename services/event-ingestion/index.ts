import type { CampusEventSource } from "./types"
import { extractDeterministic, type ExtractedFoodEvent } from "./extract"
import { berkeleyLiveSource } from "./sources/berkeley-live"
import { callinkSource } from "./sources/callink-live"

export * from "./types"
export * from "./extract"
export { berkeleyMockSource } from "./sources/berkeley-mock"
export { berkeleyLiveSource } from "./sources/berkeley-live"
export { callinkSource } from "./sources/callink-live"

// Default ingestion is live-only. Sample adapters remain an explicit export
// for test/demo callers and cannot enter an ordinary live ingestion result.
export const sources: CampusEventSource[] = [berkeleyLiveSource, callinkSource]

export async function ingestAll(): Promise<ExtractedFoodEvent[]> {
  const results = await Promise.all(sources.map((s) => s.fetchEvents()))
  return results.flat().map(extractDeterministic).filter((e) => e.confidenceScore > 0)
}

export async function ingestSource(source: CampusEventSource): Promise<ExtractedFoodEvent[]> {
  const events = await source.fetchEvents()
  return events.map(extractDeterministic).filter((e) => e.confidenceScore > 0)
}
