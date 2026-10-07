import { describe, it, expect, vi, beforeEach } from "vitest"

const { answerDeterministically, answerWithLLM, isOpenAIConfigured } = vi.hoisted(() => ({
  answerDeterministically: vi.fn(),
  answerWithLLM: vi.fn(),
  isOpenAIConfigured: vi.fn(),
}))

vi.mock("@/lib/chatbot", () => ({ answerDeterministically, answerWithLLM, isOpenAIConfigured }))

const { POST } = await import("./route")

function req(body: unknown) {
  return new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("POST /api/chat", () => {
  it("rejects oversized bodies before invoking either reply path", async () => {
    const response = await POST(req({ message: "x".repeat(40000) }))
    expect(response.status).toBe(413)
    expect(answerWithLLM).not.toHaveBeenCalled()
    expect(answerDeterministically).not.toHaveBeenCalled()
  })
  it("rejects overlong messages and malformed JSON", async () => {
    expect((await POST(req({ message: "x".repeat(2001) }))).status).toBe(400)
    expect((await POST(new Request("http://localhost/api/chat", { method: "POST", body: "invalid" }))).status).toBe(400)
  })
  it("bounds conversation history passed to the configured provider", async () => {
    isOpenAIConfigured.mockReturnValue(true)
    answerWithLLM.mockResolvedValue("ok")
    await POST(req({ message: "hi", history: Array.from({ length: 15 }, () => ({ role: "user", content: "prior" })) }))
    expect(answerWithLLM.mock.calls[0][1]).toHaveLength(10)
  })
  it("400s on an empty message", async () => {
    isOpenAIConfigured.mockReturnValue(false)
    const res = await POST(req({ message: "  " }))
    expect(res.status).toBe(400)
  })

  it("uses the deterministic path when OpenAI isn't configured", async () => {
    isOpenAIConfigured.mockReturnValue(false)
    answerDeterministically.mockResolvedValue("deterministic reply")

    const res = await POST(req({ message: "hi" }))
    const body = await res.json()

    expect(body).toEqual({ reply: "deterministic reply", source: "deterministic" })
    expect(answerWithLLM).not.toHaveBeenCalled()
  })

  it("uses the LLM path when configured and it succeeds", async () => {
    isOpenAIConfigured.mockReturnValue(true)
    answerWithLLM.mockResolvedValue("llm reply")

    const res = await POST(req({ message: "hi", history: [{ role: "user", content: "prior" }] }))
    const body = await res.json()

    expect(body).toEqual({ reply: "llm reply", source: "llm" })
    expect(answerWithLLM).toHaveBeenCalledWith("hi", [{ role: "user", content: "prior" }])
  })

  it("falls back to the deterministic path when the LLM call throws", async () => {
    isOpenAIConfigured.mockReturnValue(true)
    answerWithLLM.mockRejectedValue(new Error("OpenAI chat completion returned 429"))
    answerDeterministically.mockResolvedValue("deterministic reply")

    const res = await POST(req({ message: "hi" }))
    const body = await res.json()

    expect(body).toEqual({ reply: "deterministic reply", source: "deterministic" })
  })

  it("drops malformed history entries before passing them to the LLM", async () => {
    isOpenAIConfigured.mockReturnValue(true)
    answerWithLLM.mockResolvedValue("ok")

    await POST(
      req({
        message: "hi",
        history: [{ role: "user", content: "ok" }, { role: "system", content: "bad role" }, "not an object", { role: "user" }],
      }),
    )

    expect(answerWithLLM).toHaveBeenCalledWith("hi", [{ role: "user", content: "ok" }])
  })
})
