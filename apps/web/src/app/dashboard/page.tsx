import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { university } from "@/lib/mock-data"

// No force-dynamic: see the same note in api/recommendations/route.ts —
// this page already renders per-request (searchParams + cookies() via
// getConnectedCalendarAccessToken), so removing it only stops the
// per-source fetch caching from being silently overridden to no-store.

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams
  const budget = Number(searchParams.budget ?? 60)
  const maxTravelMinutes = Number(searchParams.maxTravelMinutes ?? 20)

  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes, calendarAccessToken: calendarAccessToken ?? undefined })
  const freeFood = recommendations.filter((r) => r.kind === "free_food")
  const projectedSpend = Math.max(0, budget - recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0) * 0.4)
  const projectedSavings = Math.max(0, budget - projectedSpend)

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <section>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Today at {university.name}</h1>
            {meta.freeFood.source === "mock-fallback" && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
                title={meta.freeFood.error}
              >
                Live calendar unreachable — showing fallback
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
          <p className="text-muted-foreground mb-4 text-sm">Free food, ranked by value and how close it is.</p>
          <div className="space-y-3">
            {freeFood.length === 0 && (
              <p className="text-muted-foreground text-sm">No free food found on today&apos;s calendar.</p>
            )}
            {freeFood.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-muted-foreground text-sm">{r.subtitle}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatTime(r.startTime)}
                      {r.distanceMinutes != null ? ` · ${r.distanceMinutes} min away` : " · distance unknown"}
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
              <CardTitle>This Week</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-muted-foreground text-xs">Budget</p>
                <p className="text-xl font-semibold">${budget.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Projected spend</p>
                <p className="text-xl font-semibold">${projectedSpend.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Projected savings</p>
                <p className="text-xl font-semibold text-green-600">${projectedSavings.toFixed(2)}</p>
              </div>
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
