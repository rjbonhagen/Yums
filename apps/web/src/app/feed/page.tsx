import Link from "next/link"
import { Nav } from "@/components/nav"
import { RecommendationsView } from "@/components/recommendations-view"
import { NotificationToggle } from "@/components/notification-toggle"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"

// No force-dynamic: see the same note in api/recommendations/route.ts —
// this page reads cookies() via getConnectedCalendarAccessToken so it
// still renders per-request; removing the flag only stops it from
// silently forcing every underlying fetch() to no-store.

export default async function FeedPage() {
  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const { recommendations, meta } = await buildRecommendations({
    maxTravelMinutes: 20,
    calendarAccessToken: calendarAccessToken ?? undefined,
  })

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Campus Feed</h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Free food is live from events.berkeley.edu&apos;s public calendar and Cal Link&apos;s club-events
          feed; nearby eats are live from OpenStreetMap.
        </p>
        {meta.freeFood.source === "mock-fallback" && (
          <p className="text-muted-foreground text-xs">
            Couldn&apos;t reach the live events calendar just now ({meta.freeFood.error}) — free food below is
            from a fallback list.
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

        <NotificationToggle freeFoodEvents={recommendations.filter((r) => r.kind === "free_food")} />

        <RecommendationsView recommendations={recommendations} />
      </main>
    </div>
  )
}
