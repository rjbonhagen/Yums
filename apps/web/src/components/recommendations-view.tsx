"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { savedKey } from "@/lib/save-identity"
import { saveGuestItem, removeGuestItem, useGuestSavedItems } from "@/lib/guest-saved-items"

function kindLabel(kind: string, estimatedSavings: number): string {
  if (kind === "free_food") return "FREE"
  if (kind === "nearby_eats") return "Nearby"
  return `$${estimatedSavings.toFixed(2)} off`
}

// Recommendation ids aren't stable save-to-save (they're derived from the
// live source, which can return different results next time) — this key
// is what actually identifies "the same place/event" for save/unsave
// matching, both here and in lib/saved-items.ts's SavedItem shape.
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
          {r.isSample && <p className="text-xs text-amber-700">Sample listing · not a real offer</p>}
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
              {saved ? "Saved" : "Save"}
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
            <p className="text-muted-foreground text-xs">Matching event titles · {items.length} upcoming</p>
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
                    {savedByKey.has(savedKey(r)) ? "Saved" : "Save"}
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
  const [cloudSavedByKey, setSavedByKey] = useState<Map<string, string>>(new Map())
  const guestItems = useGuestSavedItems()
  const savedByKey = new Map([...guestItems.filter((item) => !userId || item.isSample).map((item) => [savedKey(item), item.id] as const), ...cloudSavedByKey])
  const [saveError, setSaveError] = useState<string | null>(null)
  const savingKeys = useRef(new Set<string>())
  const account = useRef<{ id: string | null | undefined; revision: number; active: boolean; loading: boolean }>({ id: undefined, revision: 0, active: true, loading: true })

  useEffect(() => {
    const trackedAccount = account.current
    account.current.active = true
    const initialRevision = account.current.revision
    if (!isSupabaseConfigured()) {
      account.current.id = null
      account.current.loading = false
      return () => { trackedAccount.active = false; trackedAccount.revision++ }
    }
    const supabase = createClient()
    function restore(user: { id: string } | null) {
      account.current.id = user?.id ?? null
      account.current.loading = Boolean(user)
      const revision = ++account.current.revision
      setUserId(account.current.id)
      setSavedByKey(new Map())
      setSaveError(null)
      if (!user) return
      loadSavedItems(supabase, user.id)
        .then((items) => {
          if (account.current.active && revision === account.current.revision) {
            setSavedByKey(new Map(items.map((it) => [savedKey(it), it.id])))
          }
        })
        .catch(() => {
          if (account.current.active && revision === account.current.revision) {
            setSaveError("Couldn't load account saves. You can still save new items.")
          }
        })
        .finally(() => {
          if (account.current.active && revision === account.current.revision) account.current.loading = false
        })
    }
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!account.current.active || account.current.revision !== initialRevision) return
      if (error) throw error
      restore(user)
    }).catch(() => {
      if (account.current.active && account.current.revision === initialRevision) {
        setSaveError("Couldn't check your account. Refresh before saving.")
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!account.current.active || (event !== "SIGNED_IN" && event !== "SIGNED_OUT")) return
      if ((session?.user.id ?? null) === account.current.id) return
      restore(session?.user ?? null)
    })
    return () => { trackedAccount.active = false; trackedAccount.revision++; subscription.unsubscribe() }
  }, [])

  async function handleToggleSave(r: Recommendation) {
    const key = `${account.current.revision}:${savedKey(r)}`
    if (savingKeys.current.has(key)) return
    savingKeys.current.add(key)
    try { await toggleSave(r) } finally { savingKeys.current.delete(key) }
  }

  async function toggleSave(r: Recommendation) {
    setSaveError(null)
    if (account.current.id === undefined && !r.isSample) {
      setSaveError("Your account isn't ready. Refresh before saving.")
      return
    }
    if (account.current.loading && !r.isSample) {
      setSaveError("Account saves are loading. Try again in a moment.")
      return
    }
    if (!userId || r.isSample) {
      try {
        const existing = savedByKey.get(savedKey(r))
        if (existing) removeGuestItem(existing)
        else saveGuestItem(r)
      } catch { setSaveError("Couldn't save in this browser. Check that site storage is allowed.") }
      return
    }
    const supabase = createClient()
    const revision = account.current.revision
    const current = () => account.current.active && revision === account.current.revision
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!current()) return
      if (error) throw error
      if (user?.id !== userId) {
        setSaveError("Your account changed. Refresh before saving.")
        return
      }
    } catch {
      if (current()) setSaveError("Couldn't check your account. Try again.")
      return
    }
    const key = savedKey(r)
    const existingId = savedByKey.get(key)
    if (existingId?.startsWith("pending:")) return

    if (existingId) {
      setSavedByKey((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
      try {
        await unsaveItem(supabase, userId, existingId)
      } catch {
        if (!current()) return
        setSaveError("Couldn't remove the saved item. Try again.")
        setSavedByKey((prev) => new Map(prev).set(key, existingId)) // revert — don't lie about saved state
      }
      return
    }

    const optimisticId = `pending:${key}`
    setSavedByKey((prev) => new Map(prev).set(key, optimisticId))
    try {
      const saved = await saveRecommendation(supabase, userId, r)
      if (!current()) return
      setSavedByKey((prev) => new Map(prev).set(key, saved.id))
    } catch {
      if (!current()) return
      setSaveError("Couldn't save this item. Try again.")
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

  const mappable = useMemo(() => filtered.filter((r) => r.latitude != null && r.longitude != null), [filtered])

  return (
    <div className="space-y-3">
      {!userId && <p className="text-muted-foreground text-xs">Saves stay in this browser. Sign in to save across devices.</p>}
      {saveError && <p role="alert" className="text-destructive text-sm">{saveError}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          {KIND_FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={kindFilter === f.value ? "default" : "outline"}
              onClick={() => setKindFilter(f.value)}
              aria-pressed={kindFilter === f.value}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Input
          aria-label="Search food events and places"
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
                signedIn={true}
                savedByKey={savedByKey}
                onToggleSave={handleToggleSave}
              />
            ) : (
              <RecommendationCard
                key={entry.item.id}
                r={entry.item}
                signedIn={true}
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
