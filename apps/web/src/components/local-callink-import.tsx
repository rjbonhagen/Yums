"use client"

import { useMemo, useRef, useState, useSyncExternalStore } from "react"
import { parseCalLinkCalendar, calLinkEventUrl, MAX_CALENDAR_BYTES, type ImportedCalLinkEvent } from "@yums/event-ingestion/callink-calendar"
import { Button } from "@/components/ui/button"
import { formatEventDateTime } from "@/lib/format"
import { campusDate } from "@/lib/event-time"

const STORAGE_KEY = "yums:private-callink:v1"
const CHANGE_EVENT = "yums-private-callink-change"
function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => { window.removeEventListener(CHANGE_EVENT, callback); window.removeEventListener("storage", callback) }
}
function snapshot() {
  try { return sessionStorage.getItem(STORAGE_KEY) ?? "" } catch { return "" }
}
function readStored(value: string): ImportedCalLinkEvent[] {
  try {
    const events: unknown = JSON.parse(value)
    if (!Array.isArray(events) || events.length > 250) return []
    return events.filter((event): event is ImportedCalLinkEvent => event && typeof event === "object"
      && typeof event.id === "string" && typeof event.title === "string" && event.title.length <= 160
      && typeof event.organization === "string"
      && (!event.description || typeof event.description === "string")
      && (!event.locationName || typeof event.locationName === "string")
      && calLinkEventUrl(event.sourceUrl) === event.sourceUrl
      && typeof event.startTime === "string" && Number.isFinite(Date.parse(event.startTime))
      && (!event.endTime || (typeof event.endTime === "string" && Date.parse(event.endTime) > Date.parse(event.startTime))))
  } catch { return [] }
}
function writeStored(events: ImportedCalLinkEvent[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function Details({ event }: { event: ImportedCalLinkEvent }) {
  const endLabel = event.endTime && (campusDate(new Date(event.startTime)) === campusDate(new Date(event.endTime))
    ? new Date(event.endTime).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" })
    : formatEventDateTime(event.endTime))
  return <div className="space-y-2">
    <p className="text-sm font-medium text-primary">{formatEventDateTime(event.startTime)}{endLabel && ` – ${endLabel}`}</p>
    <h3 className="text-lg font-semibold">{event.title}</h3>
    <p className="text-sm text-muted-foreground">{event.organization}{event.locationName && ` · ${event.locationName}`}</p>
    {event.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{event.description}</p>}
    <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="inline-block py-2 text-sm text-primary underline underline-offset-4">Check original event</a>
  </div>
}

export function LocalCalLinkImport() {
  const serialized = useSyncExternalStore(subscribe, snapshot, () => "")
  const kept = useMemo(() => readStored(serialized), [serialized])
  const [candidates, setCandidates] = useState<ImportedCalLinkEvent[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const revision = useRef(0)

  async function readFile(file: File) {
    const current = ++revision.current
    setError(null); setMessage(null); setCandidates([]); setSelected(new Set()); setSkipped(0); setBusy(false)
    if (file.size > MAX_CALENDAR_BYTES) { setError("Choose a calendar export smaller than 512 KB."); return }
    setBusy(true)
    try {
      const result = parseCalLinkCalendar(await file.text())
      if (current !== revision.current) return
      setCandidates(result.events); setSkipped(result.skipped)
      if (!result.events.length) setMessage("No upcoming events with supported dates and Cal Link source links were found.")
    } catch (problem) {
      if (current === revision.current) setError(problem instanceof Error ? problem.message : "Couldn’t read this calendar export.")
    } finally { if (current === revision.current) setBusy(false) }
  }

  function keepSelected() {
    setError(null)
    if (!selected.size) { setError("Check the source and confirm free food for an event first."); return }
    const merged = new Map(kept.map((event) => [event.id, event]))
    for (const event of candidates) if (selected.has(event.id)) merged.set(event.id, event)
    if (merged.size > 250) { setError("Keep up to 250 events in this tab. Clear older imports first."); return }
    try {
      writeStored([...merged.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)))
      setMessage(`${selected.size} ${selected.size === 1 ? "event kept" : "events kept"} privately in this tab.`)
      setCandidates([]); setSelected(new Set())
    } catch { setError("Couldn’t keep events in this tab. Check that browser storage is allowed.") }
  }

  return <div className="space-y-7">
    <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="choose-export">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="choose-export" className="text-lg font-semibold">1. Choose your calendar export</h2>
        <a href="https://callink.berkeley.edu/events?perks=FreeFood" target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">Open Cal Link food events</a>
      </div>
      <p className="text-sm text-muted-foreground">Use the .ics file from an event’s iCal/Outlook link. The file is read in your browser. Times must include a time zone; use Cal Link’s original export.</p>
      <label className="block space-y-2 text-sm font-medium">Calendar file
        <input type="file" accept=".ics,text/calendar" aria-label="Calendar file" className="block w-full rounded-lg border bg-background p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-primary"
          onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = "" }} />
      </label>
      {busy && <p role="status" className="text-sm text-muted-foreground">Reading your export…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {skipped > 0 && <p className="text-sm text-muted-foreground">Skipped {skipped} duplicate, past, cancelled, or unsupported {skipped === 1 ? "entry" : "entries"}. Recurring, all-day, and non-UTC exports are not supported.</p>}
    </section>
    {candidates.length > 0 && <section className="space-y-4" aria-labelledby="review-import">
      <div className="space-y-2"><h2 id="review-import" className="text-xl font-semibold">2. Review {candidates.length} {candidates.length === 1 ? "event" : "events"}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Calendar exports can omit the Free Food tag. Check each original event and confirm the offer before keeping it. Free admission alone does not mean free food.</p></div>
      {candidates.map((event) => <article key={event.id} className="space-y-4 rounded-2xl border bg-card p-5">
        <Details event={event} />
        <p className="text-xs text-muted-foreground">{event.foodEvidence ? "The export mentions an explicit free-food offer. Check eligibility and availability in the source." : "This export does not explicitly confirm free food. Check the event’s description or Free Food perk."}</p>
        <label className="flex items-start gap-3 border-t pt-4 text-sm font-medium">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={selected.has(event.id)}
            onChange={(change) => setSelected((previous) => { const next = new Set(previous); if (change.target.checked) next.add(event.id); else next.delete(event.id); return next })} />
          I checked the source and it offers free food: {event.title}
        </label>
      </article>)}
      <Button type="button" className="min-h-11 rounded-full px-6" onClick={keepSelected}>Keep selected in this tab ({selected.size})</Button>
    </section>}
    <section className="space-y-4 border-t pt-6" aria-labelledby="private-events">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="private-events" className="text-xl font-semibold">Your private imports ({kept.length})</h2>
        {kept.length > 0 && <Button variant="outline" type="button" onClick={() => {
          try { writeStored([]); setMessage("Private imports cleared. You can import the original files again."); setError(null) }
          catch { setError("Couldn’t clear this tab’s imports. Check browser storage settings.") }
        }}>Clear private imports</Button>}
      </div>
      <p className="text-sm text-muted-foreground">Visible in this browser tab only, until you clear them or close the tab. These are imported snapshots; check Cal Link for changes. Times are shown in Berkeley time.</p>
      {!kept.length && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No private imports yet. Choose an export and review its food offer above.</p>}
      {kept.map((event) => <article key={event.id} className="rounded-2xl border bg-card p-5"><Details event={event} /><p className="mt-3 text-xs font-medium text-primary">Food offer checked by you · Private import</p></article>)}
    </section>
  </div>
}
