import { NextRequest, NextResponse } from "next/server"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { getPreferences } from "@/lib/server-preferences"

// No force-dynamic (that would force every fetch() to no-store). This
// route still renders dynamically anyway since it reads searchParams and
// cookies() (getConnectedCalendarAccessToken) — both Request-time APIs.
// That alone would normally disable the Data Cache for every fetch in this
// render too (verified empirically — see docs/architecture.md's caching
// notes), which is why the three live sources are wrapped in unstable_cache
// inside recommendations.ts rather than relying on each fetch's own
// cache/revalidate option: unstable_cache persists across requests
// regardless of whether the calling route is dynamically rendered.

export async function GET(request: NextRequest) {
  const preferences = await getPreferences(Object.fromEntries(request.nextUrl.searchParams))
  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const { recommendations, meta } = await buildRecommendations({
    maxTravelMinutes: preferences.maxTravelMinutes,
    optimizeFor: preferences.optimizeFor,
    calendarAccessToken: calendarAccessToken ?? undefined,
  })
  return NextResponse.json({ recommendations, meta })
}
