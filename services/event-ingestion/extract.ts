import type { CampusEvent } from "./types"

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
  const text = `${event.title} ${event.description ?? ""}`.toLowerCase()
  const contradicted = /\b(?:no|not|without|never)\s+(?:(?:a|any|longer)\s+)?(?:free|complimentary)\b|\b(?:isn't|aren't|won't be)\s+free\b|\b(?:cancelled|canceled|sold out|no longer available)\b/.test(text)
  const confirmed = !contradicted && (event.freeFoodConfirmed === true || hasExplicitFreeFoodOffer(text))

  return {
    ...event,
    food: confirmed ? guessFoodPhrase(text) : undefined,
    confidenceScore: confirmed ? 0.9 : 0,
  }
}

// Food mentions, free admission, and dietary phrases are not evidence of
// a free meal. Prefer missing an ambiguous offer to inventing one.
function hasExplicitFreeFoodOffer(text: string): boolean {
  const food = "(?:food|pizza|boba|coffee|snacks|refreshments|breakfast|lunch|dinner|sandwiches|tacos|meals)"
  const offer = new RegExp(`\\b(?:free|complimentary|no-cost)\\s+${food}\\b|\\b${food}\\s+(?:is\\s+|are\\s+|will be\\s+)?(?:free|complimentary|provided at no charge)\\b`, "i")
  return text.split(/[.!?\n]/).some((sentence) => {
    if (/\b(?:no|not|without|never)\s+(?:any\s+)?(?:free|complimentary)\b|\b(?:isn't|aren't|won't be)\s+free\b/.test(sentence)) return false
    if (/\b(?:discuss|discussion|debate|research|policy|survey|study|studying)\b/.test(sentence)) return false
    if (/\b(?:gluten|dairy|nut|sugar|caffeine|allergen)[ -]free\b/.test(sentence)) return false
    if (/\$\s*\d|\b(?:paid|purchase|buy|costs?|fee|ticket required)\b/.test(sentence)) return false
    return offer.test(sentence)
  })
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
