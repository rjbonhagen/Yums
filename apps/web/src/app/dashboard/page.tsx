import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { university } from "@/lib/mock-data"

export const dynamic = "force-dynamic"

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const searchParams = await props.searchParams
  const budget = Number(searchParams.budget ?? 60)
  const maxTravelMinutes = Number(searchParams.maxTravelMinutes ?? 20)

  const mealSwipesRemaining = searchParams.mealSwipes != null ? Number(searchParams.mealSwipes) : null
  const diningDollarsRemaining = searchParams.diningDollars != null ? Number(searchParams.diningDollars) : null
  const daysLeftInTerm = searchParams.daysLeft != null ? Number(searchParams.daysLeft) : null
  const hasMealPlanInput = mealSwipesRemaining != null && diningDollarsRemaining != null && daysLeftInTerm != null

  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes })
  const freeFood = recommendations.filter((r) => r.kind === "free_food")
  const projectedSpend = Math.max(0, budget - recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0) * 0.4)
  const projectedSavings = Math.max(0, budget - projectedSpend)

  const projectedDiningDollarsUnused = hasMealPlanInput
    ? Math.max(0, diningDollarsRemaining! - daysLeftInTerm! * 12)
    : 0

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
          <Card>
            <CardHeader>
              <CardTitle>Meal Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {hasMealPlanInput ? (
                <>
                  <p>{mealSwipesRemaining} meal swipes remaining</p>
                  <p>${diningDollarsRemaining!.toFixed(2)} dining dollars remaining</p>
                  <p>{daysLeftInTerm} days left in the term</p>
                  {projectedDiningDollarsUnused > 0 && (
                    <p className="text-amber-600">
                      You&apos;re on pace to leave ~${projectedDiningDollarsUnused.toFixed(0)} of dining dollars
                      unused. Use dining dollars for a few lunches this week instead of buying groceries.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  Enter your meal swipes and dining dollars on the{" "}
                  <Link href="/start" className="underline underline-offset-4">
                    Build My Week
                  </Link>{" "}
                  form to see pacing here — this app has no way to look up your real balance, that has to
                  come from you.
                </p>
              )}
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
