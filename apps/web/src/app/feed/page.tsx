import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { getConnectedCalendarAccessToken } from "@/lib/google-calendar"
import { optimizeGroceryList, cheapestSingleStorePlan } from "@/lib/grocery-optimizer"
import { fetchRealGroceryStoreLocations } from "@/lib/grocery-stores"
import { haversineMinutes } from "@/lib/geo"

// No force-dynamic: see the same note in api/recommendations/route.ts —
// this page reads cookies() via getConnectedCalendarAccessToken so it
// still renders per-request; removing the flag only stops it from
// silently forcing every underlying fetch() to no-store.

const CAMPUS_CENTER = { lat: 37.8719, lng: -122.2585 }
const BBOX: [number, number, number, number] = [37.83, -122.3, 37.9, -122.22]
const DEFAULT_BASKET = ["Eggs", "Greek Yogurt", "Bananas", "Chicken", "Rice", "Oats"]

async function fetchStoreDistances(): Promise<{ byChain: Record<string, number>; error?: string }> {
  try {
    const stores = await fetchRealGroceryStoreLocations(BBOX)
    const byChain: Record<string, number> = {}
    for (const [chain, place] of Object.entries(stores)) {
      byChain[chain] = haversineMinutes(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng, place.latitude, place.longitude)
    }
    return { byChain }
  } catch (err) {
    return { byChain: {}, error: err instanceof Error ? err.message : "fetch failed" }
  }
}

function distanceForStore(byChain: Record<string, number>, storeName: string): number | undefined {
  const lower = storeName.toLowerCase()
  const match = Object.keys(byChain).find((chain) => lower.includes(chain))
  return match ? byChain[match] : undefined
}

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function kindLabel(kind: string, estimatedSavings: number): string {
  if (kind === "free_food") return "FREE"
  if (kind === "nearby_eats") return "Nearby"
  return `$${estimatedSavings.toFixed(2)} off`
}

export default async function FeedPage() {
  const calendarAccessToken = await getConnectedCalendarAccessToken()
  const [{ recommendations, meta }, storeDistances] = await Promise.all([
    buildRecommendations({ maxTravelMinutes: 20, calendarAccessToken: calendarAccessToken ?? undefined }),
    fetchStoreDistances(),
  ])
  const multiStore = optimizeGroceryList(DEFAULT_BASKET)
  const singleStore = cheapestSingleStorePlan(DEFAULT_BASKET)

  const savingsFromSplitting =
    singleStore != null ? Math.max(0, singleStore.totalCost - multiStore.totalCost) : 0

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Campus Feed</h1>
        <p className="text-muted-foreground mb-2 text-sm">
          Free food is live from events.berkeley.edu&apos;s public calendar and Cal Link&apos;s club-events
          feed; nearby eats are live from OpenStreetMap. Grocery pricing below is a manually maintained
          reference, not a live feed — no retailer publishes one (see docs/data-sources.md).
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
                {r.subtitle && <p className="text-muted-foreground text-sm">{r.subtitle}</p>}
                <p className="text-muted-foreground text-xs">
                  {formatTime(r.startTime)}
                  {r.startTime && r.distanceMinutes != null ? " · " : ""}
                  {r.distanceMinutes != null
                    ? `${r.distanceEstimated ? "~" : ""}${r.distanceMinutes} min away`
                    : r.startTime
                      ? ""
                      : "distance unknown"}
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
                {kindLabel(r.kind, r.estimatedSavings)}
              </Badge>
            </CardContent>
          </Card>
        ))}

        <div id="basket" className="pt-4">
          <h2 className="mb-2 text-lg font-semibold">Your Basket</h2>
          <div className="space-y-3">
            {Object.entries(multiStore.itemsByStore).map(([store, items]) => {
              const distance = distanceForStore(storeDistances.byChain, store)
              return (
              <Card key={store}>
                <CardContent className="py-4">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-medium">{store}</p>
                    {distance != null && (
                      <span className="text-muted-foreground text-xs">~{distance} min walk (live location)</span>
                    )}
                  </div>
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
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
