"use client"

import { useEffect, useMemo, useState } from "react"
import type { Recommendation } from "@yums/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeedMap } from "@/components/feed-map"
import { formatEventDateTime } from "@/lib/format"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { loadSavedItems, saveRecommendation, unsaveItem } from "@/lib/saved-items"

function kindLabel(kind: string, estimatedSavings: number): string {
  if (kind === "free_food") return "FREE"
  if (kind === "nearby_eats") return "Nearby"
  return `$${estimatedSavings.toFixed(2)} off`
}

// Recommendation ids aren't stable save-to-save (they're derived from the
// live source, which can return different results next time) — this key
// is what actually identifies "the same place/event" for save/unsave
// matching, both here and in lib/saved-items.ts's SavedItem shape.
function savedKey(r: { kind: string; title: string; sourceUrl?: string }): string {
  return `${r.kind}::${r.title}::${r.sourceUrl ?? ""}`
}

function RecommendationCard({
  r,
  signedIn,
  saved,
  onToggleSave,
}: {
  r: Recommendation
  signedIn: boolean
  saved: boolean
  onToggleSave: (r: Recommendation) => void
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div>
          <p className="font-medium">{r.title}</p>
          {r.subtitle && <p className="text-muted-foreground text-sm">{r.subtitle}</p>}
          <p className="text-muted-foreground text-xs">
            {formatEventDateTime(r.startTime)}
            {r.durationEstimated ? " · duration estimated at 1 hour" : ""}
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
        <div className="flex flex-col items-end gap-2">
          <Badge variant={r.kind === "free_food" ? "default" : "secondary"}>{kindLabel(r.kind, r.estimatedSavings)}</Badge>
          {signedIn && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-auto p-0 text-xs"
              onClick={() => onToggleSave(r)}
              aria-pressed={saved}
            >
              {saved ? "★ Saved" : "☆ Save"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Groups multiple upcoming instances of the exact same recurring meeting
 * (same Recommendation.seriesKey — organization + original title, an
 * exact match, never a fuzzy/guessed one — see that field's comment in
 * packages/shared/types.ts) into one card instead of N separate ones.
 * Preserves per-instance Save controls and Source links; Map view is
 * unaffected (still plots every instance individually). Only groups when
 * 2+ items actually share a key — a lone free_food item just renders as
 * a normal RecommendationCard. */
function RecurringGroupCard({
  items,
  signedIn,
  savedByKey,
  onToggleSave,
}: {
  items: Recommendation[]
  signedIn: boolean
  savedByKey: Map<string, string>
  onToggleSave: (r: Recommendation) => void
}) {
  const [first] = items
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{first.title}</p>
            {first.subtitle && <p className="text-muted-foreground text-sm">{first.subtitle}</p>}
            <p className="text-muted-foreground text-xs">Recurring · {items.length} upcoming</p>
          </div>
          <Badge variant={first.kind === "free_food" ? "default" : "secondary"}>
            {kindLabel(first.kind, first.estimatedSavings)}
          </Badge>
        </div>
        <ul className="space-y-1.5 border-t pt-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">
                {formatEventDateTime(r.startTime)}
                {r.durationEstimated ? " · duration estimated at 1 hour" : ""}
                {r.distanceMinutes != null ? ` · ${r.distanceEstimated ? "~" : ""}${r.distanceMinutes} min away` : ""}
              </span>
              <div className="flex items-center gap-2">
                {r.sourceUrl && (
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                    Source
                  </a>
                )}
                {signedIn && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-auto p-0 text-xs"
                    onClick={() => onToggleSave(r)}
                    aria-pressed={savedByKey.has(savedKey(r))}
                    aria-label={savedByKey.has(savedKey(r)) ? "Unsave" : "Save"}
                  >
                    {savedByKey.has(savedKey(r)) ? "★" : "☆"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

type ListEntry = { kind: "single"; item: Recommendation } | { kind: "group"; seriesKey: string; items: Recommendation[] }

function groupBySeries(items: Recommendation[]): ListEntry[] {
  const placed = new Set<string>()
  const entries: ListEntry[] = []
  for (const item of items) {
    if (item.kind === "free_food" && item.seriesKey) {
      if (placed.has(item.seriesKey)) continue // already emitted as part of an earlier group in this pass
      const group = items.filter((i) => i.kind === "free_food" && i.seriesKey === item.seriesKey)
      if (group.length > 1) {
        placed.add(item.seriesKey)
        entries.push({ kind: "group", seriesKey: item.seriesKey, items: group })
        continue
      }
    }
    entries.push({ kind: "single", item })
  }
  return entries
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
 * optional integrations. Signed-in users can save/unsave items (see
 * lib/saved-items.ts, /saved); the save controls simply don't render when
 * signed out, same pattern as /login's Google Calendar card. */
export function RecommendationsView({ recommendations }: { recommendations: Recommendation[] }) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [search, setSearch] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [savedByKey, setSavedByKey] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null)
      if (!user) return
      loadSavedItems(supabase, user.id)
        .then((items) => setSavedByKey(new Map(items.map((it) => [savedKey(it), it.id]))))
        .catch(() => {
          // Saved state just stays empty — save/unsave still works for new
          // items, it just can't show which of *these* were already saved.
        })
    })
  }, [])

  async function handleToggleSave(r: Recommendation) {
    if (!userId) return
    const supabase = createClient()
    const key = savedKey(r)
    const existingId = savedByKey.get(key)

    if (existingId) {
      setSavedByKey((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      try {
        await unsaveItem(supabase, userId, existingId)
      } catch {
        setSavedByKey((prev) => new Map(prev).set(key, existingId)) // revert — don't lie about saved state
      }
      return
    }

    const optimisticId = `pending:${key}`
    setSavedByKey((prev) => new Map(prev).set(key, optimisticId))
    try {
      const saved = await saveRecommendation(supabase, userId, r)
      setSavedByKey((prev) => new Map(prev).set(key, saved.id))
    } catch {
      setSavedByKey((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    }
  }

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
          {groupBySeries(filtered).map((entry) =>
            entry.kind === "group" ? (
              <RecurringGroupCard
                key={entry.seriesKey}
                items={entry.items}
                signedIn={userId != null}
                savedByKey={savedByKey}
                onToggleSave={handleToggleSave}
              />
            ) : (
              <RecommendationCard
                key={entry.item.id}
                r={entry.item}
                signedIn={userId != null}
                saved={savedByKey.has(savedKey(entry.item))}
                onToggleSave={handleToggleSave}
              />
            ),
          )}
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
