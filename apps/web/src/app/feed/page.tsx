import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { optimizeGroceryList, cheapestSingleStorePlan } from "@/lib/grocery-optimizer"
import { berkeleyLiveSource, ingestSource, type ExtractedFoodEvent } from "@campus/event-ingestion"

export const dynamic = "force-dynamic"

const DEFAULT_BASKET = ["Eggs", "Greek Yogurt", "Bananas", "Chicken", "Rice", "Oats"]

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

async function fetchLiveEvents(): Promise<{ events: ExtractedFoodEvent[]; error?: string }> {
  try {
    const events = await ingestSource(berkeleyLiveSource)
    return { events }
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : "fetch failed" }
  }
}

export default async function FeedPage() {
  const recommendations = buildRecommendations({ maxTravelMinutes: 20 })
  const multiStore = optimizeGroceryList(DEFAULT_BASKET)
  const singleStore = cheapestSingleStorePlan(DEFAULT_BASKET)
  const live = await fetchLiveEvents()

  const savingsFromSplitting =
    singleStore != null ? Math.max(0, singleStore.totalCost - multiStore.totalCost) : 0

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Campus Feed</h1>
        <p className="text-muted-foreground mb-2 text-sm">Nearby savings, ranked for you.</p>

        <Card>
          <CardContent className="space-y-1 py-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Cheapest groceries this week</p>
              <Badge>${multiStore.totalCost.toFixed(2)}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Across {multiStore.storeCount} store{multiStore.storeCount === 1 ? "" : "s"}:{" "}
              {Object.keys(multiStore.itemsByStore).join(", ")}
            </p>
            {singleStore && savingsFromSplitting > 0.01 && (
              <p className="text-muted-foreground text-xs">
                {singleStore.storeName} alone: ${singleStore.totalCost.toFixed(2)} — splitting saves $
                {savingsFromSplitting.toFixed(2)} but adds a trip.
              </p>
            )}
            <a href="#basket" className="text-primary text-sm underline underline-offset-4">
              View basket
            </a>
          </CardContent>
        </Card>

        {recommendations.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="text-muted-foreground text-sm">{r.subtitle}</p>
                <p className="text-muted-foreground text-xs">
                  {formatTime(r.startTime)} · {r.distanceMinutes} min away
                </p>
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline underline-offset-4"
                  >
                    Source
                  </a>
                )}
              </div>
              <Badge variant={r.kind === "free_food" ? "default" : "secondary"}>
                {r.kind === "free_food" ? "FREE" : `$${r.estimatedSavings.toFixed(2)} off`}
              </Badge>
            </CardContent>
          </Card>
        ))}

        <div className="pt-4">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Live from Berkeley&apos;s events calendar</h2>
            <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
              Live
            </Badge>
          </div>
          <p className="text-muted-foreground mb-3 text-xs">
            Pulled just now from events.berkeley.edu&apos;s public calendar feed and filtered to titles that
            mention food. Only titles/times are available from this feed, so these aren&apos;t scored or
            ranked like the recommendations above.
          </p>
          {live.error && (
            <p className="text-muted-foreground text-sm">Couldn&apos;t reach the live calendar right now ({live.error}).</p>
          )}
          {!live.error && live.events.length === 0 && (
            <p className="text-muted-foreground text-sm">No food-related events found on today&apos;s calendar.</p>
          )}
          <div className="space-y-3">
            {live.events.map((e, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatTime(e.startTime)}
                    {e.food && ` · mentions: ${e.food}`}
                  </p>
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                    Source
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div id="basket" className="pt-4">
          <h2 className="mb-2 text-lg font-semibold">Your Basket</h2>
          <div className="space-y-3">
            {Object.entries(multiStore.itemsByStore).map(([store, items]) => (
              <Card key={store}>
                <CardContent className="py-4">
                  <p className="mb-1 font-medium">{store}</p>
                  <ul className="text-muted-foreground text-sm">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>${item.price.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
