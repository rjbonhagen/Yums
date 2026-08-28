import { NextRequest, NextResponse } from "next/server"
import { buildRecommendations } from "@/lib/recommendations"

export async function GET(request: NextRequest) {
  const maxTravelMinutes = Number(request.nextUrl.searchParams.get("maxTravelMinutes") ?? 20)
  const recommendations = buildRecommendations({ maxTravelMinutes })
  return NextResponse.json({ recommendations })
}
