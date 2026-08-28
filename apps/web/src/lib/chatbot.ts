import { university } from "./mock-data"
import { buildRecommendations } from "./recommendations"
import { optimizeGroceryList } from "./grocery-optimizer"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/**
 * Grounded in buildRecommendations() — the same live data (or documented
 * fallback) the rest of the app uses — instead of letting an LLM guess at
 * deterministic facts. Swap for callOpenAI() below once a real
 * OPENAI_API_KEY exists and open-ended questions need handling.
 */
export async function answerDeterministically(message: string): Promise<string> {
  const text = message.toLowerCase()

  if (/free ?food|free lunch|free dinner|free pizza|free\b/.test(text)) {
    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 30 })
    const freeFood = recommendations.filter((r) => r.kind === "free_food")
    if (freeFood.length === 0) {
      return `No free food found on ${university.name}'s calendar right now.`
    }
    const lines = freeFood
      .slice(0, 5)
      .map((r) => `- ${r.title}${r.subtitle ? ` at ${r.subtitle}` : ""}${r.startTime ? `, ${formatTime(r.startTime)}` : ""}`)
    const notes = [
      meta.freeFood.source === "mock-fallback" ? "live calendar was unreachable, showing fallback" : null,
      meta.callink.source === "unavailable" ? "Cal Link was unreachable, club events omitted" : null,
    ].filter((n): n is string => n != null)
    const note = notes.length > 0 ? ` (${notes.join("; ")})` : ""
    return `Here's what's free near ${university.name} today${note}:\n${lines.join("\n")}`
  }

  if (/deal|discount|coupon|bogo|nearby eat|restaurant|cafe/.test(text)) {
    const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 30 })
    const eats = recommendations.filter((r) => r.kind === "nearby_eats")
    if (meta.nearbyEats.source === "unavailable") {
      return "Couldn't reach OpenStreetMap for nearby places just now — try again in a bit."
    }
    if (eats.length === 0) {
      return "No nearby eats found."
    }
    const lines = eats.slice(0, 5).map((e) => `- ${e.title}${e.distanceMinutes != null ? ` (${e.distanceMinutes} min away)` : ""}`)
    return `Real cafes/restaurants near campus (no live discount data exists, so no savings claims here):\n${lines.join("\n")}`
  }

  if (/grocer|shopping|basket|cart/.test(text)) {
    const plan = optimizeGroceryList(["Eggs", "Greek Yogurt", "Bananas", "Chicken", "Rice", "Oats"])
    const stores = Object.entries(plan.itemsByStore)
      .map(([store, items]) => `${store} (${items.map((i) => i.name).join(", ")})`)
      .join("; ")
    return `Cheapest basket from reference pricing: $${plan.totalCost.toFixed(2)} across ${plan.storeCount} store(s) — ${stores}. (Prices are a manually maintained reference, not live — no retailer publishes one.) Full basket is on the Feed page.`
  }

  if (/swipe|dining dollar|meal plan/.test(text)) {
    return "Meal plan pacing isn't something I can look up — this app has no access to your real dining account. Enter your swipes and dining dollars on the Build My Week form and pacing advice will show up on your dashboard."
  }

  if (/budget|spend|afford|save|savings/.test(text)) {
    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })
    const top = recommendations[0]
    if (!top) return "Set your budget on the Build My Week form and I'll build a full weekly plan."
    return `Set your budget on the Build My Week form and I'll build a full weekly plan. Right now the best opportunity I can see is: ${top.title}${top.subtitle ? ` (${top.subtitle})` : ""}${top.distanceMinutes != null ? `, ${top.distanceMinutes} min away` : ""}.`
  }

  return "I can tell you about free food happening today, nearby eats, cheapest groceries, or how to set up meal plan pacing — ask me about any of those."
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
