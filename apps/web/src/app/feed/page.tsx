import Link from "next/link"
import { Nav } from "@/components/nav"
import { RecommendationsView } from "@/components/recommendations-view"
import { NotificationToggle } from "@/components/notification-toggle"
import { CommunityReports } from "@/components/community-reports"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { createClient } from "@/lib/supabase/server"
import { loadUpcomingReportedEvents, type ReportedEvent } from "@/lib/reported-events"
import { getPreferences } from "@/lib/server-preferences"

// No force-dynamic: see the same note in api/recommendations/route.ts —
// this page reads cookies() via getConnectedCalendarAccessToken so it
// still renders per-request; removing the flag only stops it from
// silently forcing every underlying fetch() to no-store.

async function loadCommunityReports(): Promise<{ userId: string | null; reports: ReportedEvent[] }> {
  if (!isSupabaseConfigured()) return { userId: null, reports: [] }
  const supabase = await createClient()
  const [{ data: { user } }, reports] = await Promise.all([
    supabase.auth.getUser(),
    loadUpcomingReportedEvents(supabase).catch(() => []),
  ])
  return { userId: user?.id ?? null, reports }
}

export default async function FeedPage() {
  const preferences = await getPreferences()
  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const [{ recommendations, meta }, { userId, reports }] = await Promise.all([
    buildRecommendations({ maxTravelMinutes: preferences.maxTravelMinutes, optimizeFor: preferences.optimizeFor, calendarAccessToken: calendarAccessToken ?? undefined }),
    loadCommunityReports(),
  ])

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Campus Feed</h1>
        <p className="text-muted-foreground text-sm">Today and the next six days · times in Berkeley (Pacific Time).</p>
        <p className="text-muted-foreground text-xs">Ranked for {preferences.optimizeFor === "fast" ? "shorter walks" : "free food"} · preferred walk: {preferences.maxTravelMinutes} minutes from campus center. Longer walks may still appear.</p>
        <p className="text-muted-foreground mb-2 text-sm">
          Free food is live from events.berkeley.edu&apos;s public calendar and Cal Link&apos;s club-events
          feed; nearby eats are live from OpenStreetMap.
        </p>
        {meta.freeFood.source === "demo" && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Sample demo data · these events and restaurants are examples, not real offers.</p>}
        {meta.freeFood.source === "unavailable" && (
          <p className="text-muted-foreground text-xs">
            Couldn&apos;t reach the Berkeley calendar just now — its events are omitted.
          </p>
        )}
        {meta.callink.source === "unavailable" && (
          <p className="text-muted-foreground text-xs">
            Couldn&apos;t reach Cal Link just now ({meta.callink.error}) — club events are omitted below.
          </p>
        )}
        {meta.nearbyEats.source === "unavailable" && (
          <p className="text-muted-foreground text-xs">
            Couldn&apos;t reach OpenStreetMap for nearby eats just now ({meta.nearbyEats.error}).
          </p>
        )}
        {meta.schedule.source === "live" && (
          <p className="text-muted-foreground text-xs">
            Ranked using your connected Google Calendar — items that conflict with your schedule are
            deprioritized.
          </p>
        )}
        {meta.schedule.source === "placeholder" && (
          <p className="text-muted-foreground text-xs">
            Not using your real schedule yet —{" "}
            <Link href="/login" className="underline underline-offset-4">
              connect Google Calendar
            </Link>{" "}
            to rank recommendations by when you&apos;re actually free.
          </p>
        )}
        {meta.schedule.source === "unavailable" && (
          <p className="text-muted-foreground text-xs">
            Couldn&apos;t reach Google Calendar just now ({meta.schedule.error}) — using a flat placeholder
            schedule score instead.
          </p>
        )}

        <NotificationToggle freeFoodEvents={recommendations.filter((r) => r.kind === "free_food" && !r.isSample)} />

        <RecommendationsView recommendations={recommendations} />

        <CommunityReports userId={userId} reports={reports} />
      </main>
    </div>
  )
}
