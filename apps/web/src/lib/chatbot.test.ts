import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Recommendation } from "@yums/shared"

vi.mock("./recommendations", () => ({ buildRecommendations: vi.fn() }))

const { buildRecommendations } = await import("./recommendations")
const { answerWithLLM, isOpenAIConfigured } = await import("./chatbot")

const FREE_EVENT: Recommendation = {
  id: "1",
  kind: "free_food",
  title: "Free pizza",
  subtitle: "ACM · Soda Hall",
  estimatedSavings: 8,
  startTime: "2026-08-29T18:00:00Z",
  score: 1,
}

const NEARBY: Recommendation = {
  id: "2",
  kind: "nearby_eats",
  title: "Caffé Strada",
  estimatedSavings: 0,
  distanceMinutes: 6,
  score: 0.5,
}

const EMPTY_META = {
  freeFood: { source: "live" as const },
  callink: { source: "live" as const },
  nearbyEats: { source: "live" as const },
  schedule: { source: "placeholder" as const },
}

beforeEach(() => {
  vi.mocked(buildRecommendations).mockReset()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("isOpenAIConfigured", () => {
  it("reflects whether OPENAI_API_KEY is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    expect(isOpenAIConfigured()).toBe(false)

    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    expect(isOpenAIConfigured()).toBe(true)
  })
})

describe("answerWithLLM", () => {
  it("throws without a configured key, before making any network call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(answerWithLLM("hi")).rejects.toThrow(/OPENAI_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("grounds the system prompt in real recommendation data and returns the model's reply", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.mocked(buildRecommendations).mockResolvedValue({ recommendations: [FREE_EVENT, NEARBY], meta: EMPTY_META })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Free pizza at Soda Hall tonight!" } }] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const reply = await answerWithLLM("what's free today?")

    expect(reply).toBe("Free pizza at Soda Hall tonight!")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.openai.com/v1/chat/completions")
    const payload = JSON.parse(init.body)
    expect(payload.messages[0].role).toBe("system")
    expect(payload.messages[0].content).toContain("Free pizza")
    expect(payload.messages[0].content).toContain("Caffé Strada")
    expect(payload.messages.at(-1)).toEqual({ role: "user", content: "what's free today?" })
  })

  it("passes prior conversation turns through to the model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.mocked(buildRecommendations).mockResolvedValue({ recommendations: [], meta: EMPTY_META })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "ok" } }] }) })
    vi.stubGlobal("fetch", fetchMock)

    await answerWithLLM("follow-up question", [{ role: "user", content: "earlier question" }])

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(payload.messages).toContainEqual({ role: "user", content: "earlier question" })
  })

  it("throws when OpenAI returns a non-OK response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.mocked(buildRecommendations).mockResolvedValue({ recommendations: [], meta: EMPTY_META })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }))

    await expect(answerWithLLM("hi")).rejects.toThrow(/429/)
  })

  it("throws when OpenAI returns no message content", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test")
    vi.mocked(buildRecommendations).mockResolvedValue({ recommendations: [], meta: EMPTY_META })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }))

    await expect(answerWithLLM("hi")).rejects.toThrow(/empty response/)
  })
})
