import { NextRequest, NextResponse } from "next/server"
import { buildRecommendations } from "@/lib/recommendations"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const maxTravelMinutes = Number(request.nextUrl.searchParams.get("maxTravelMinutes") ?? 20)
  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes })
  return NextResponse.json({ recommendations, meta })
}
