import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  }
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return NextResponse.json({ error: "Sign in required" }, { status: 401 })
    const result = await client.from("calendar_connections").delete().eq("user_id", user.id)
    if (result.error) throw result.error
    return NextResponse.json({ disconnected: true })
  } catch {
    return NextResponse.json({ error: "Calendar connection is unavailable. Try again." }, { status: 503 })
  }
}
