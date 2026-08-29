"use client"

import { useMemo, useState } from "react"
import type { Recommendation } from "@yums/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeedMap } from "@/components/feed-map"
import { formatEventDateTime } from "@/lib/format"

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
            {formatEventDateTime(r.startTime)}
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

type KindFilter = "all" | "free_food" | "nearby_eats"

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free_food", label: "Free food" },
  { value: "nearby_eats", label: "Nearby eats" },
]

/** List/map toggle for /feed's recommendations, with a free-food/nearby-eats
 * filter and keyword search over title/subtitle — both computed client-side
 * over the same recommendations the server already fetched, no extra
 * requests. Map tab only ever plots items with real coordinates (see
 * FeedMap) and shows an honest "not configured" message instead of a broken
 * map when no Mapbox token is set — same pattern as the rest of the app's
 * optional integrations. */
export function RecommendationsView({ recommendations }: { recommendations: Recommendation[] }) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return recommendations.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false
      if (!query) return true
      return r.title.toLowerCase().includes(query) || (r.subtitle?.toLowerCase().includes(query) ?? false)
    })
  }, [recommendations, kindFilter, search])

  const mappable = filtered.filter((r) => r.latitude != null && r.longitude != null)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {KIND_FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={kindFilter === f.value ? "default" : "outline"}
              onClick={() => setKindFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or location…"
          className="sm:max-w-56"
        />
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="map">Map</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-3 pt-3">
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {recommendations.length === 0
                ? "Nothing found right now — check back later."
                : "Nothing matches your filter/search."}
            </p>
          )}
          {filtered.map((r) => (
            <RecommendationCard key={r.id} r={r} />
          ))}
        </TabsContent>
        <TabsContent value="map" className="pt-3">
          <FeedMap places={mappable} />
          {mappable.length < filtered.length && (
            <p className="text-muted-foreground pt-2 text-xs">
              {filtered.length - mappable.length} item{filtered.length - mappable.length === 1 ? "" : "s"} without a
              known location {filtered.length - mappable.length === 1 ? "isn't" : "aren't"} shown on the map.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
