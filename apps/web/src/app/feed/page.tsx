import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { optimizeGroceryList, cheapestSingleStorePlan } from "@/lib/grocery-optimizer"

const DEFAULT_BASKET = ["Eggs", "Greek Yogurt", "Bananas", "Chicken", "Rice", "Oats"]

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export default function FeedPage() {
  const recommendations = buildRecommendations({ maxTravelMinutes: 20 })
  const multiStore = optimizeGroceryList(DEFAULT_BASKET)
  const singleStore = cheapestSingleStorePlan(DEFAULT_BASKET)

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
