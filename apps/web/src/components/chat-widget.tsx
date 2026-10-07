"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Ask me what's free today or what's nearby.",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)

  async function send() {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    setMessages((prev) => [...prev, { role: "user", content: trimmed }])
    setInput("")
    setSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sends prior turns so a real LLM (once OPENAI_API_KEY is set, see
        // /api/chat/route.ts) has conversational context; the deterministic
        // fallback ignores it.
        body: JSON.stringify({ message: trimmed, history: messages.slice(-10) }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.ok ? data.reply : "Something went wrong — try again." },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the assistant — try again." }])
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 shadow-lg"
        size="lg"
      >
        Ask Yums
      </Button>
    )
  }

  return (
    <Card role="dialog" aria-label="Yums chat" className="fixed right-4 bottom-4 z-50 flex h-[28rem] max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100vw-2rem)] flex-col shadow-xl">
      <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-sm">Yums Assistant</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground text-sm"
          aria-label="Close chat"
        >
          Close
        </button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden pt-0">
        <div role="log" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-line"
                  : "bg-muted max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-line"
              }
            >
              {m.content}
            </div>
          ))}
          {sending && <div className="text-muted-foreground text-xs">Thinking…</div>}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <Input
            aria-label="Message to Yums"
            maxLength={2000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What's free today?"
            className="text-sm"
          />
          <Button type="submit" size="sm" disabled={sending || !input.trim()}>
            Send
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
