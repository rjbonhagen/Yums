import { NextResponse } from "next/server"
import { getCachedBerkeleyEvents } from "@/lib/public-calendar-cache"

// Shares the feed's public-source cache. This narrow endpoint performs food
// extraction but does not apply the final date-window filter or scoring. The UI uses
// buildRecommendations(); /api/recommendations exposes that complete path.
export async function GET() {
  try {
    const events = await getCachedBerkeleyEvents()
    return NextResponse.json({ source: "events.berkeley.edu", events })
  } catch (err) {
    return NextResponse.json(
      { source: "events.berkeley.edu", events: [], error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    )
  }
}
