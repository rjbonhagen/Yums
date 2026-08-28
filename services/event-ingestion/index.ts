import type { CampusEventSource } from "./types"
import { extractDeterministic, type ExtractedFoodEvent } from "./extract"
import { berkeleyMockSource } from "./sources/berkeley-mock"
import { berkeleyLiveSource } from "./sources/berkeley-live"

export * from "./types"
export * from "./extract"
export { berkeleyMockSource } from "./sources/berkeley-mock"
export { berkeleyLiveSource } from "./sources/berkeley-live"

export const sources: CampusEventSource[] = [berkeleyMockSource, berkeleyLiveSource]

export async function ingestAll(): Promise<ExtractedFoodEvent[]> {
  const results = await Promise.all(sources.map((s) => s.fetchEvents()))
  return results.flat().map(extractDeterministic).filter((e) => e.confidenceScore > 0)
}

export async function ingestSource(source: CampusEventSource): Promise<ExtractedFoodEvent[]> {
  const events = await source.fetchEvents()
  return events.map(extractDeterministic).filter((e) => e.confidenceScore > 0)
}
