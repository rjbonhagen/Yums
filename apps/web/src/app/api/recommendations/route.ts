import { NextRequest, NextResponse } from "next/server"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { getPreferences } from "@/lib/server-preferences"

// Request preferences and Calendar access render per request. Public
// discovery sources use bounded shared cache windows in recommendations.ts.

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
