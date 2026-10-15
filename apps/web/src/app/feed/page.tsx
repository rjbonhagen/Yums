import Link from "next/link"
import { Nav } from "@/components/nav"
import { RecommendationsView } from "@/components/recommendations-view"
import { CommunityReports } from "@/components/community-reports"
import { buildRecommendations } from "@/lib/recommendations"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { createClient } from "@/lib/supabase/server"
import { loadUpcomingReportedEvents, type ReportedEvent } from "@/lib/reported-events"

export const dynamic = "force-dynamic"

async function loadCommunityReports(): Promise<{ userId: string | null; reports: ReportedEvent[]; unavailable?: boolean }> {
  if (!isSupabaseConfigured()) return { userId: null, reports: [] }
  try {
    const supabase = await createClient()
    const [{ data: { user } }, reportResult] = await Promise.all([
      supabase.auth.getUser(),
      loadUpcomingReportedEvents(supabase).then((reports) => ({ reports, unavailable: false })).catch(() => ({ reports: [], unavailable: true })),
    ])
    return { userId: user?.id ?? null, ...reportResult }
  } catch {
    return { userId: null, reports: [], unavailable: true }
  }
}

export default async function FeedPage() {
  const [{ recommendations, meta }, { userId, reports, unavailable }] = await Promise.all([
    buildRecommendations({ maxTravelMinutes: 20, freeFoodOnly: true }),
    loadCommunityReports(),
  ])
  const missingSources = [
    meta.freeFood.source === "unavailable" ? "Berkeley calendar" : null,
    meta.callink.source === "unavailable" ? "Cal Link" : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-5 pb-16 pt-10 sm:pt-14">
        <section className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-primary">UC Berkeley</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Free food, all in one place.</h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">Find what&apos;s happening, when to go, and where to get it. Collected from campus calendars and community tips.</p>
        </section>
        {meta.freeFood.source === "demo" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sample events for preview only. These are not real food offers.</p>}
        {missingSources.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {missingSources.join(" and ")} {missingSources.length === 1 ? "is" : "are"} unavailable right now. {missingSources.length === 2 ? "We can’t check campus events. Try again later." : "Events from other sources still appear."}
        </p>}
        <RecommendationsView key={userId ?? "guest"} recommendations={recommendations} now={new Date().toISOString()} />
        <section className="border-t pt-8" aria-label="Community tips">
          {unavailable ? <p role="status" className="text-sm text-muted-foreground">Community reports are unavailable right now.</p>
            : <CommunityReports key={`${userId}:${JSON.stringify(reports)}`} userId={userId} reports={reports} />}
        </section>
        <footer className="flex flex-col justify-between gap-3 border-t pt-5 text-sm text-muted-foreground sm:flex-row">
          <p>Times are in Berkeley. Check the original post for attendance rules.</p>
          <Link href="/report" className="shrink-0 text-primary underline underline-offset-4">Know about free food?</Link>
        </footer>
      </main>
    </div>
  )
}
