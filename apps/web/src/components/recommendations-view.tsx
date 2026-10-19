"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { isAuthSessionMissingError } from "@supabase/supabase-js"
import type { Recommendation } from "@yums/shared"
import { ArrowRight, Heart, MapPin, Search } from "lucide-react"
import { FoodPhoto } from "@/components/food-photo"
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
    if (host === "grad.berkeley.edu") return "Graduate Division"
    return host || "Original announcement"
  } catch { return "Original announcement" }
}

export function RecommendationsView({ recommendations, now: initialNow, notices, children }: {
  recommendations: Recommendation[]; now?: string; notices?: ReactNode; children?: ReactNode
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week")
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("all")
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

  const sources = useMemo(() => [...new Set(recommendations.filter((event) => event.kind === "free_food")
    .map((event) => sourceName(event.sourceUrl)))].sort(), [recommendations])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return collapseDuplicateListings(recommendations.filter((event) => source === "all" || sourceName(event.sourceUrl) === source), savedByKey)
      .filter((event) => {
        if (event.kind !== "free_food") return false
        if (event.startTime && !isInCampusWeek(event.startTime, event.endTime, now)) return false
        if (dateFilter === "today" && !isToday(event.startTime, now, event.endTime)) return false
        if (dateFilter === "tomorrow" && (!event.startTime || campusDate(new Date(event.startTime)) !== addCalendarDays(campusDate(now), 1))) return false
        return !query || `${event.title} ${event.subtitle ?? ""}`.toLowerCase().includes(query)
      })
      .sort((a, b) => (a.startTime ? Date.parse(a.startTime) : Infinity) - (b.startTime ? Date.parse(b.startTime) : Infinity))
  }, [recommendations, savedByKey, dateFilter, search, source, now])

  return (
    <>
      <section aria-labelledby="discover-title" className="bg-primary pb-10 pt-5 text-white sm:pb-12 sm:pt-7">
        <div className="mx-auto grid max-w-[1184px] items-end gap-7 px-5 sm:px-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
          <div>
            <h1 id="discover-title" className="font-heading text-[58px] font-extrabold uppercase leading-[0.96] tracking-tight sm:text-[70px]">
              Good food.<br /><span className="text-accent">Zero dollars.</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/85">Free food around campus, collected in one place.<br />Less searching. More showing up.</p>
          </div>
          <div className="pb-1">
            <label htmlFor="food-search" className="mb-2.5 block text-sm text-white/85">Find your next bite</label>
            <form role="search" onSubmit={(event) => event.preventDefault()} className="flex min-h-14 items-center gap-3 rounded-xl bg-white p-1.5 pl-4 text-primary">
              <Search size={20} aria-hidden="true" className="shrink-0" />
              <input id="food-search" aria-label="Search free food" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Pizza, boba, or a spot on campus" className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <button type="submit" aria-label="Search events" className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-primary hover:bg-accent/80"><ArrowRight size={19} aria-hidden="true" /></button>
            </form>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80"><MapPin size={14} aria-hidden="true" /><strong className="font-semibold text-white">UC Berkeley</strong><span aria-hidden="true">/</span>Campus and nearby</p>
          </div>
        </div>
      </section>
      <div className="mx-auto w-full max-w-[1184px] space-y-8 px-5 pb-12 pt-8 sm:px-8 sm:pt-9">
      {notices}
      <section aria-label="Free food events" className="space-y-5">
        <div className="flex items-center justify-between gap-5">
          <div><h2 className="text-2xl font-semibold tracking-tight sm:text-[27px]">Your next free bite</h2><p className="mt-1 text-sm text-muted-foreground">From public campus calendars. Only explicit free-food offers.</p></div>
          <p className="hidden text-right text-xs leading-relaxed text-muted-foreground sm:block">Campus announcements.<br />Original sources, always linked.</p>
        </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-label="Filter by date" className="flex flex-wrap gap-2">
          {DATE_FILTERS.map((filter) => (
            <button key={filter.value} type="button"
              className={`min-h-10 rounded-full border px-4 text-sm transition-colors sm:px-5 ${dateFilter === filter.value ? "border-primary bg-primary text-white" : "bg-card hover:bg-secondary"}`}
              aria-pressed={dateFilter === filter.value} onClick={() => setDateFilter(filter.value)}>
              {filter.label}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">From
          <select aria-label="Filter by campus source" value={source} onChange={(event) => setSource(event.target.value)} className="min-h-10 rounded-lg border bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">All campus sources</option>
            {sources.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">{filtered.length} {filtered.length === 1 ? "campus event" : "campus events"}</p>
        <p>{userId ? "Saves sync to your account." : "No account needed. Saves stay in this browser."}</p>
      </div>
      {saveError && <p role="alert" className="text-destructive text-sm">{saveError}</p>}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <h3 className="text-lg font-semibold">{search || source !== "all" ? "No matching food events" : "No free-food listings found"}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search || source !== "all" ? "Try another search or campus source." : dateFilter === "week" ? "Check back later or share an opportunity you know about." : "Try This week to see other upcoming events."}
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {filtered.map((event) => (
            <article key={event.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
              <FoodPhoto text={`${event.title} ${event.subtitle ?? ""}`} time={event.startTime ? `${isToday(event.startTime, now) ? "Today, " : ""}${formatEventDateTime(event.startTime, now)}` : "See announcement for time"}>
                <button type="button" title={`${savedByKey.has(savedKey(event)) ? "Unsave" : "Save"} ${event.title}`}
                  className={`absolute right-3 top-3 grid size-10 place-items-center rounded-full shadow-sm transition-colors ${savedByKey.has(savedKey(event)) ? "bg-primary text-accent" : "bg-white text-primary hover:bg-secondary"}`}
                  aria-describedby={`event-title-${event.id}`} aria-pressed={savedByKey.has(savedKey(event))} onClick={() => handleToggleSave(event)}>
                  <Heart size={18} aria-hidden="true" fill={savedByKey.has(savedKey(event)) ? "currentColor" : "none"} />
                  <span className="sr-only">{savedByKey.has(savedKey(event)) ? "Saved" : "Save"}</span>
                </button>
              </FoodPhoto>
              <div className="flex flex-1 flex-col p-4 sm:p-[18px]">
                <p className="mb-2 text-xs text-muted-foreground">{sourceName(event.sourceUrl)}</p>
                <h3 id={`event-title-${event.id}`} className="text-lg font-semibold leading-snug tracking-tight">{event.title}</h3>
                {event.subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{event.subtitle}</p>}
                {event.isSample && <p className="mt-2 text-sm text-amber-800">Sample event, not a real offer</p>}
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="min-h-8 py-1 text-xs text-primary underline underline-offset-4">
                    View announcement <span className="sr-only">({sourceName(event.sourceUrl)})</span>
                  </a> : <p className="py-1 text-xs text-muted-foreground">Check attendance rules</p>}
                  <span className="pb-1 text-lg font-bold text-primary">Free</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      </section>
      {children}
      </div>
    </>
  )
}
