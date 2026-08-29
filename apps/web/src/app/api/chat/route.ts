import { NextResponse } from "next/server"
import { answerDeterministically, answerWithLLM, isOpenAIConfigured, type ChatMessage } from "@/lib/chatbot"

function parseHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (m): m is ChatMessage =>
      typeof m === "object" &&
      m !== null &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const history = parseHistory(body?.history)

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  if (isOpenAIConfigured()) {
    try {
      const reply = await answerWithLLM(message, history)
      return NextResponse.json({ reply, source: "llm" })
    } catch {
      // Bad/expired key, rate limit, or an OpenAI outage should degrade to
      // the deterministic path below, not break the chatbot entirely.
    }
  }

  const reply = await answerDeterministically(message)
  return NextResponse.json({ reply, source: "deterministic" })
}
