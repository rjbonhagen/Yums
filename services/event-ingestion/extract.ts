import type { CampusEvent } from "./types"
import { mentionsFood } from "./types"

export interface ExtractedFoodEvent extends CampusEvent {
  food?: string
  confidenceScore: number
}

/**
 * Deterministic fallback extractor. Used when no LLM is configured, and as
 * the baseline the LLM-based extractor (see extractWithLLM below) should
 * beat. Confidence is a heuristic, not a model output.
 */
export function extractDeterministic(event: CampusEvent): ExtractedFoodEvent {
  const hasFood = mentionsFood(event)
  const text = `${event.title} ${event.description ?? ""}`.toLowerCase()

  let confidence = 0
  if (hasFood) {
    confidence = 0.5
    if (text.includes("free food") || text.includes("free pizza")) confidence = 0.9
    else if (["pizza", "boba", "catering", "snacks", "refreshments"].some((k) => text.includes(k)))
      confidence = 0.75
  }

  return {
    ...event,
    food: hasFood ? guessFoodPhrase(text) : undefined,
    confidenceScore: confidence,
  }
}

function guessFoodPhrase(text: string): string | undefined {
  const known = ["pizza", "boba", "coffee", "snacks", "refreshments", "catering", "breakfast", "lunch", "dinner"]
  const found = known.filter((k) => text.includes(k))
  return found.length > 0 ? found.join(", ") : undefined
}

/**
 * NOT IMPLEMENTED. This is where an LLM call should replace/augment
 * extractDeterministic to pull out food descriptions and set confidence
 * from free-text event descriptions (per docs/architecture.md AI
 * responsibilities: "extracting food information from event descriptions").
 * Left unimplemented until an API key / provider is wired up.
 */
export async function extractWithLLM(_event: CampusEvent): Promise<ExtractedFoodEvent> {
  throw new Error("extractWithLLM is not implemented yet — see services/event-ingestion/extract.ts")
}
