import { university } from "./mock-data"
import { buildRecommendations } from "./recommendations"
import { formatEventDateTime } from "./format"

function formatTime(iso: string): string {
  return formatEventDateTime(iso)
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
    return `Here's what's free near ${university.name} this week${note} (times in Berkeley):\n${lines.join("\n")}`
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

  if (/budget|spend|afford|save|savings/.test(text)) {
    const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })
    const top = recommendations[0]
    if (!top) return "Set your budget target on Build My Week. No food opportunities were found right now; actual spending and savings aren't tracked."
    return `Set your budget target on Build My Week. Actual spending and savings aren't tracked. A current opportunity is: ${top.title}${top.subtitle ? ` (${top.subtitle})` : ""}${top.distanceMinutes != null ? `, approximately ${top.distanceMinutes} minutes from campus center` : ""}.`
  }

  return "I can tell you about free food happening today or nearby eats — ask me about either of those."
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY)
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = "gpt-4o-mini"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Real LLM path for open-ended natural-language questions (e.g. "feed me
 * for a week for $50" from the original spec), once OPENAI_API_KEY is
 * configured — see /api/chat/route.ts for the fallback-on-failure wiring.
 * Grounded in the same live buildRecommendations() data
 * answerDeterministically() uses: the system prompt hands the model
 * today's real free food/nearby eats and explicitly instructs it to
 * answer only from that, never invent events, businesses, or discounts —
 * same no-fabrication standard as the rest of this app, just enforced via
 * the prompt instead of a keyword match.
 */
export async function answerWithLLM(message: string, history: ChatMessage[] = []): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const { recommendations } = await buildRecommendations({ maxTravelMinutes: 20 })
  const freeFood = recommendations.filter((r) => r.kind === "free_food").slice(0, 8)
  const nearbyEats = recommendations.filter((r) => r.kind === "nearby_eats").slice(0, 8)

  const context = [
    `Free food events this week at ${university.name} (a limited source list; times in Berkeley; do not invent more):`,
    ...(freeFood.length > 0
      ? freeFood.map(
          (r) => `- ${r.title}${r.subtitle ? ` at ${r.subtitle}` : ""}${r.startTime ? `, ${formatTime(r.startTime)}` : ""}`,
        )
      : ["(none found right now)"]),
    "",
    "Real nearby cafes/restaurants (no discount data exists for any of these — never state a savings amount for them):",
    ...(nearbyEats.length > 0
      ? nearbyEats.map((r) => `- ${r.title}${r.distanceMinutes != null ? ` (${r.distanceMinutes} min away)` : ""}`)
      : ["(none found right now)"]),
  ].join("\n")

  const systemPrompt = `You are Yums, a budget/food assistant for ${university.name} students. Answer ONLY using the real data below — never invent free food events, businesses, discounts, or prices that aren't listed. If asked about something this data doesn't cover (a specific dish, a discount percentage, a dining-account balance, etc.), say plainly that you don't have that information rather than guessing. Keep answers short and concrete.\n\n${context}`

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`OpenAI chat completion returned ${res.status}`)

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const reply = body.choices?.[0]?.message?.content?.trim()
  if (!reply) throw new Error("OpenAI returned an empty response")
  return reply
}
