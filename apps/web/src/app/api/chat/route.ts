import { NextResponse } from "next/server"
import { answerDeterministically } from "@/lib/chatbot"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const message = typeof body?.message === "string" ? body.message.trim() : ""

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  // Deterministic responder only for now — see apps/web/src/lib/chatbot.ts
  // for the answerWithLLM() stub that takes over once OPENAI_API_KEY is set.
  const reply = answerDeterministically(message)
  return NextResponse.json({ reply })
}
