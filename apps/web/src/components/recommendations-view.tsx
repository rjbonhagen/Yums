"use client"

import type { Recommendation } from "@yums/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeedMap } from "@/components/feed-map"

function formatTime(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function kindLabel(kind: string, estimatedSavings: number): string {
  if (kind === "free_food") return "FREE"
  if (kind === "nearby_eats") return "Nearby"
  return `$${estimatedSavings.toFixed(2)} off`
}

function RecommendationCard({ r }: { r: Recommendation }) {
  return (
    <Card>
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
            <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
              Source
            </a>
          )}
        </div>
        <Badge variant={r.kind === "free_food" ? "default" : "secondary"}>{kindLabel(r.kind, r.estimatedSavings)}</Badge>
      </CardContent>
    </Card>
  )
}

/** List/map toggle for /feed's recommendations. Map tab only ever plots
 * items with real coordinates (see FeedMap) and shows an honest
 * "not configured" message instead of a broken map when no Mapbox token
 * is set — same pattern as the rest of the app's optional integrations. */
export function RecommendationsView({ recommendations }: { recommendations: Recommendation[] }) {
  const mappable = recommendations.filter((r) => r.latitude != null && r.longitude != null)

  return (
    <Tabs defaultValue="list">
      <TabsList>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="space-y-3 pt-3">
        {recommendations.map((r) => (
          <RecommendationCard key={r.id} r={r} />
        ))}
      </TabsContent>
      <TabsContent value="map" className="pt-3">
        <FeedMap places={mappable} />
        {mappable.length < recommendations.length && (
          <p className="text-muted-foreground pt-2 text-xs">
            {recommendations.length - mappable.length} item{recommendations.length - mappable.length === 1 ? "" : "s"} without a
            known location {mappable.length < recommendations.length ? "aren't" : "isn't"} shown on the map.
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
