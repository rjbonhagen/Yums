import { NextResponse } from "next/server"
import { berkeleyLiveSource, ingestSource } from "@yums/event-ingestion"

// Genuinely live: hits events.berkeley.edu's public JSON calendar feed,
// cached per berkeley-live.ts's own next:{revalidate:120} (no force-dynamic
// here — that would override the fetch's own cache option to no-store on
// every request, see docs/architecture.md's data-flow notes). Separate,
// narrower JSON surface than /api/recommendations (which also hits Cal
// Link + OpenStreetMap and applies the full scoring/ranking pipeline) —
// this route is just the raw Berkeley feed. Neither route is called by
// the web UI (which uses buildRecommendations() directly), but both are
// kept as a documented public JSON API for external/future clients.
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
