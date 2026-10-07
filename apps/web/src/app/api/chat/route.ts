import { NextResponse } from "next/server"
import { answerDeterministically, answerWithLLM, isOpenAIConfigured, type ChatMessage } from "@/lib/chatbot"
import { reserveProviderReply } from "@/lib/chat-allowance"

function parseHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []
  return value.slice(-10).filter(
    (m): m is ChatMessage =>
      typeof m === "object" &&
      m !== null &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  ).map((message) => ({ ...message, content: message.content.slice(0, 2000) }))
}

async function readBody(request: Request): Promise<{ body?: unknown; status?: number }> {
  const reader = request.body?.getReader()
  if (!reader) return { status: 400 }
  const decoder = new TextDecoder()
  let text = ""
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 32768) { await reader.cancel(); return { status: 413 } }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { body: JSON.parse(text) }
  } catch { return { status: 400 } }
  finally { reader.releaseLock() }
}

export async function POST(request: Request) {
  const result = await readBody(request)
  if (result.status) return NextResponse.json({ error: result.status === 413 ? "Request too large" : "Invalid JSON" }, { status: result.status })
  const body = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {}
  const message = typeof body.message === "string" ? body.message.trim() : ""
  const history = parseHistory(body.history)

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }
  if (message.length > 2000) return NextResponse.json({ error: "message must be at most 2000 characters" }, { status: 400 })

  if (isOpenAIConfigured() && await reserveProviderReply()) {
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
