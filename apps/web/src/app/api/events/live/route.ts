import { NextResponse } from "next/server"
import { berkeleyLiveSource, ingestSource } from "@yums/event-ingestion"

// Fetches the Berkeley source from the network on each request. This narrow
// endpoint performs food extraction but does not apply the recommendation
// layer's shared cache, final date-window filter, or scoring. The UI uses
// buildRecommendations(); /api/recommendations exposes that complete path.
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
