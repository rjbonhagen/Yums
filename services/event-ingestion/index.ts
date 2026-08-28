import type { CampusEventSource } from "./types"
import { extractDeterministic, type ExtractedFoodEvent } from "./extract"
import { berkeleyMockSource } from "./sources/berkeley-mock"

export * from "./types"
export * from "./extract"

export const sources: CampusEventSource[] = [berkeleyMockSource]

export async function ingestAll(): Promise<ExtractedFoodEvent[]> {
  const results = await Promise.all(sources.map((s) => s.fetchEvents()))
  return results.flat().map(extractDeterministic).filter((e) => e.confidenceScore > 0)
}
