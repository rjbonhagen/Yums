import { NextResponse } from "next/server"
import { berkeleyLiveSource, ingestSource } from "@yums/event-ingestion"

// Genuinely live: hits events.berkeley.edu's public JSON calendar feed,
// cached per berkeley-live.ts's own next:{revalidate:120} (no force-dynamic
// here — that would override the fetch's own cache option to no-store on
// every request, see docs/architecture.md's data-flow notes). Separate
// from /api/recommendations (which stays on mock data) so a slow/
// unreachable upstream never breaks the main demo — see docs/data-sources.md.
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
