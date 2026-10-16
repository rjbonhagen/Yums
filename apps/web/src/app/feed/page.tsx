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
  const calLinkNeedsSignIn = meta.callink.source === "unavailable" && meta.callink.reason === "sign-in-required"
  const missingSources = [
    meta.freeFood.source === "unavailable" ? "Berkeley calendar" : null,
    meta.callink.source === "unavailable" && !calLinkNeedsSignIn ? "Cal Link" : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-1 flex-col">
      <Nav tone="teal" active="discover" />
      <main id="main-content" className="flex-1">
        <RecommendationsView key={userId ?? "guest"} recommendations={recommendations} now={new Date().toISOString()} notices={<>
        {meta.freeFood.source === "demo" && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Sample events for preview only. These are not real food offers.</p>}
        {calLinkNeedsSignIn && <p role="status" className="rounded-xl border bg-secondary/50 p-4 text-sm">
          Cal Link requires Berkeley CalNet sign-in, so its events can’t be imported here. {" "}
          <a href="https://callink.berkeley.edu/events" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">Browse Cal Link</a>
        </p>}
        {missingSources.length > 0 && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {missingSources.join(" and ")} {missingSources.length === 1 ? "is" : "are"} unavailable right now. {meta.freeFood.source === "unavailable" && meta.callink.source === "unavailable" ? "Campus events can’t be checked right now." : "Events from other sources still appear."}
        </p>}
        </>}>
        <section className="border-t pt-8" aria-label="Community tips">
          {unavailable ? <p role="status" className="text-sm text-muted-foreground">Community reports are unavailable right now.</p>
            : <CommunityReports key={`${userId}:${JSON.stringify(reports)}`} userId={userId} reports={reports} />}
        </section>
        <footer className="flex flex-col justify-between gap-3 border-t pt-5 text-sm text-muted-foreground sm:flex-row">
          <p>Times are in Berkeley. Check the original post for attendance rules.</p>
          <Link href="/report" className="shrink-0 text-primary underline underline-offset-4">Know about free food?</Link>
        </footer>
        </RecommendationsView>
      </main>
    </div>
  )
}
