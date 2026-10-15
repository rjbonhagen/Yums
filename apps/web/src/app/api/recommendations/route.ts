import { NextResponse } from "next/server"
import { buildRecommendations } from "@/lib/recommendations"

export async function GET() {
  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20, freeFoodOnly: true })
  return NextResponse.json({ recommendations, meta })
}
