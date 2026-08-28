import { freeFoodEvents, studentDeals, mealPlanStatus, university } from "./mock-data"
import { buildRecommendations } from "./recommendations"
import { optimizeGroceryList } from "./grocery-optimizer"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/**
 * Deterministic assistant grounded in mock-data.ts. Answers pattern-matched
 * questions with real (mock) numbers instead of letting an LLM guess at
 * prices/times — matches the "don't use an LLM for deterministic facts"
 * rule the rest of the app follows. Swap for callOpenAI() below once a real
 * OPENAI_API_KEY and live data sources exist.
 */
export function answerDeterministically(message: string): string {
  const text = message.toLowerCase()

  if (/free ?food|free lunch|free dinner|free pizza|free\b/.test(text)) {
    const lines = freeFoodEvents.map(
      (e) => `- ${e.food ? `Free ${e.food}` : "Free food"} at ${e.organization} (${e.location.name}), ${formatTime(e.startTime)}`,
    )
    return `Here's what's free near ${university.name} today:\n${lines.join("\n")}`
  }

  if (/deal|discount|coupon|bogo/.test(text)) {
    const lines = studentDeals.map((d) => `- ${d.businessName}: ${d.description} (~$${d.estimatedSavings?.toFixed(2)} off)`)
    return `Current student deals:\n${lines.join("\n")}`
  }

  if (/grocer|shopping|basket|cart/.test(text)) {
    const plan = optimizeGroceryList(["Eggs", "Greek Yogurt", "Bananas", "Chicken", "Rice", "Oats"])
    const stores = Object.entries(plan.itemsByStore)
      .map(([store, items]) => `${store} (${items.map((i) => i.name).join(", ")})`)
      .join("; ")
    return `Cheapest basket I found: $${plan.totalCost.toFixed(2)} across ${plan.storeCount} store(s) — ${stores}. Full basket is on the Feed page.`
  }

  if (/swipe|dining dollar|meal plan/.test(text)) {
    return `You have ${mealPlanStatus.mealSwipesRemaining} meal swipes and $${mealPlanStatus.diningDollarsRemaining.toFixed(2)} in dining dollars, with ${mealPlanStatus.daysLeftInTerm} days left in the term.`
  }

  if (/budget|spend|afford|save|savings/.test(text)) {
    const top = buildRecommendations({ maxTravelMinutes: 20 })[0]
    return `Set your budget on the Build My Week form and I'll build a full weekly plan. Right now the best opportunity near you is: ${top.title} (${top.subtitle}), ${top.distanceMinutes} min away.`
  }

  return "I can tell you about free food happening today, current student deals, cheapest groceries, or your meal plan / dining dollar balance — ask me about any of those."
}

/**
 * NOT WIRED UP. Real LLM path for open-ended natural-language questions
 * (e.g. "feed me for a week for $50" from the original spec) once
 * OPENAI_API_KEY is configured. Left as a stub — see
 * services/event-ingestion/extract.ts for the same pattern.
 */
export async function answerWithLLM(_message: string, _history: { role: string; content: string }[]): Promise<string> {
  throw new Error("answerWithLLM is not implemented yet — set OPENAI_API_KEY and see apps/web/src/lib/chatbot.ts")
}
