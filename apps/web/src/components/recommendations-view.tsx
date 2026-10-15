"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { isAuthSessionMissingError } from "@supabase/supabase-js"
import type { Recommendation } from "@yums/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatEventDateTime } from "@/lib/format"
import { addCalendarDays, campusDate, isInCampusWeek, isToday } from "@/lib/event-time"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { loadSavedItems, saveRecommendation, unsaveItem } from "@/lib/saved-items"
import { savedKey } from "@/lib/save-identity"
import { collapseDuplicateListings } from "@/lib/event-listings"
import { saveGuestItem, removeGuestItem, useGuestSavedItems } from "@/lib/guest-saved-items"

type DateFilter = "week" | "today" | "tomorrow"
const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
]

function sourceName(url?: string): string {
  try {
    const host = new URL(url ?? "").hostname
    if (host === "callink.berkeley.edu") return "Cal Link"
    if (host === "events.berkeley.edu") return "Berkeley calendar"
    return host || "Original announcement"
  } catch { return "Original announcement" }
}

export function RecommendationsView({ recommendations, now: initialNow }: { recommendations: Recommendation[]; now?: string }) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week")
  const [search, setSearch] = useState("")
  const [now, setNow] = useState(() => initialNow ? new Date(initialNow) : new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  const [userId, setUserId] = useState<string | null>(null)
  const [cloudSavedByKey, setSavedByKey] = useState<Map<string, string>>(new Map())
  const guestItems = useGuestSavedItems()
  const savedByKey = useMemo(() => new Map([...guestItems.filter((item) => !userId || item.isSample).map((item) => [savedKey(item), item.id] as const), ...cloudSavedByKey]), [guestItems, userId, cloudSavedByKey])
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
      if (error && !isAuthSessionMissingError(error)) throw error
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
    return collapseDuplicateListings(recommendations, savedByKey)
      .filter((event) => {
        if (event.kind !== "free_food") return false
        if (event.startTime && !isInCampusWeek(event.startTime, event.endTime, now)) return false
        if (dateFilter === "today" && !isToday(event.startTime, now, event.endTime)) return false
        if (dateFilter === "tomorrow" && (!event.startTime || campusDate(new Date(event.startTime)) !== addCalendarDays(campusDate(now), 1))) return false
        return !query || `${event.title} ${event.subtitle ?? ""}`.toLowerCase().includes(query)
      })
      .sort((a, b) => (a.startTime ? Date.parse(a.startTime) : Infinity) - (b.startTime ? Date.parse(b.startTime) : Infinity))
  }, [recommendations, savedByKey, dateFilter, search, now])

  return (
    <section aria-label="Free food events" className="space-y-5">
      <h2 className="text-lg font-semibold">Campus calendars</h2>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-label="Filter by date" className="flex gap-1 rounded-xl bg-muted p-1">
          {DATE_FILTERS.map((filter) => (
            <Button key={filter.value} type="button" size="sm"
              variant={dateFilter === filter.value ? "default" : "ghost"}
              className="min-h-10 flex-1 rounded-lg px-4 shadow-none"
              aria-pressed={dateFilter === filter.value} onClick={() => setDateFilter(filter.value)}>
              {filter.label}
            </Button>
          ))}
        </div>
        <Input aria-label="Search free food" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or location" className="h-11 rounded-xl bg-background sm:max-w-64" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "campus event" : "campus events"}</p>
        <p>{userId ? "Saves sync to your account." : "No account needed. Saves stay in this browser."}</p>
      </div>
      {saveError && <p role="alert" className="text-destructive text-sm">{saveError}</p>}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <h3 className="text-lg font-semibold">{search ? "No matching food events" : "No campus events found"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search ? "Try a different name or location." : dateFilter === "week" ? "Check back later or share an opportunity you know about." : "Try This week to see other upcoming events."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {filtered.map((event) => (
            <article key={event.id} className="flex items-start justify-between gap-4 border-b p-5 last:border-b-0 sm:p-6">
              <div className="min-w-0 space-y-2">
                <p className="text-sm font-semibold text-primary">
                  {event.startTime ? `${isToday(event.startTime, now) ? "Today, " : ""}${formatEventDateTime(event.startTime, now)}` : "See announcement for time"}
                </p>
                <h3 className="text-lg font-semibold leading-snug">{event.title}</h3>
                {event.subtitle && <p className="text-sm text-muted-foreground">{event.subtitle}</p>}
                {event.isSample && <p className="text-sm text-amber-800">Sample event, not a real offer</p>}
                {event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer"
                  className="inline-block py-1 text-sm text-primary underline underline-offset-4">
                  View announcement <span className="text-muted-foreground">({sourceName(event.sourceUrl)})</span>
                </a>}
              </div>
              <Button type="button" size="sm" variant={savedByKey.has(savedKey(event)) ? "secondary" : "outline"}
                className="mt-0.5 min-h-10 shrink-0 rounded-lg px-4 shadow-none"
                aria-pressed={savedByKey.has(savedKey(event))} onClick={() => handleToggleSave(event)}>
                {savedByKey.has(savedKey(event)) ? "Saved" : "Save"}
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
