import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { university } from "@/lib/mock-data"
import { formatEventDateTime } from "@/lib/format"
import { isToday } from "@/lib/event-time"
import { getPreferences } from "@/lib/server-preferences"

// Account preferences and Calendar access render per request; public sources
// use bounded shared cache windows in recommendations.ts.

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams
  const preferences = await getPreferences(searchParams)
  const { budget, maxTravelMinutes } = preferences

  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes, optimizeFor: preferences.optimizeFor, calendarAccessToken: calendarAccessToken ?? undefined })
  const freeFood = recommendations.filter((r) => r.kind === "free_food" && isToday(r.startTime, new Date(), r.endTime))
  const weeklyEvents = recommendations.filter((r) => r.kind === "free_food").length
  const foodUnavailable = meta.freeFood.source === "unavailable" && meta.callink.source === "unavailable"

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        {meta.freeFood.source === "demo" && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Sample demo data · these events are examples, not real offers.</p>}
        <section>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">Today at {university.name}</h1>
            {meta.freeFood.source === "unavailable" && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                title={meta.freeFood.error}
              >
                Live calendar unavailable — events omitted
              </Badge>
            )}
            {meta.callink.source === "unavailable" && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                title={meta.callink.error}
              >
                Cal Link unreachable — club events omitted
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mb-4 text-sm">Today&apos;s upcoming offers, with walking estimates from campus center. All times are in Berkeley.</p>
          <div className="space-y-3">
            {freeFood.length === 0 && (
              <p className="text-muted-foreground text-sm">{foodUnavailable
                ? "Couldn't check today's free-food offers. The campus event sources are unavailable."
                : "No free food found in the available sources for today."}</p>
            )}
            {freeFood.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    {r.isSample && <p className="text-xs text-amber-700">Sample event</p>}
                    <p className="text-muted-foreground text-sm">{r.subtitle}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatEventDateTime(r.startTime)}
                      {r.distanceMinutes != null ? ` · ${r.distanceEstimated ? "~" : ""}${r.distanceMinutes} min away` : " · distance unknown"}
                    </p>
                  </div>
                  <Badge variant="secondary">FREE</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Your week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Budget target</p>
                <p className="text-xl font-semibold">${budget.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Food events</p>
                <p className="text-xl font-semibold">{foodUnavailable ? "—" : weeklyEvents}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Preferred walk</p>
                <p className="text-xl font-semibold">{maxTravelMinutes} min</p>
              </div>
              </div>
              <p className="text-muted-foreground text-xs">Your budget is a planning target. Events may offer snacks rather than a full meal; attendance, prices, and actual savings aren&apos;t tracked.</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Link href="/feed" className="text-sm underline underline-offset-4">
            See the full campus savings feed →
          </Link>
        </section>
      </main>
    </div>
  )
}
