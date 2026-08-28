import { NextResponse } from "next/server"
import { berkeleyLiveSource, ingestSource } from "@campus/event-ingestion"

export const dynamic = "force-dynamic"

// Genuinely live: hits events.berkeley.edu's public JSON calendar feed at
// request time and filters to titles that mention food. Separate from
// /api/recommendations (which stays on mock data) so a slow/unreachable
// upstream never breaks the main demo — see docs/data-sources.md.
export async function GET() {
  try {
    const events = await ingestSource(berkeleyLiveSource)
    return NextResponse.json({ source: "events.berkeley.edu", events })
  } catch (err) {
    return NextResponse.json(
      { source: "events.berkeley.edu", events: [], error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    )
  }
}
