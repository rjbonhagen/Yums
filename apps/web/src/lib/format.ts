// Shared date/time formatting for event cards (recommendations-view.tsx,
// dashboard/page.tsx). Berkeley's calendar feed only returns today's
// events (see services/event-ingestion/sources/berkeley-live.ts), but
// Cal Link has no upper bound and can return events days/weeks out (see
// callink-live.ts) — showing only a time with no date is misleading for
// those, so this always makes "not today" explicit.
export function formatEventDateTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return ""
  const date = new Date(iso)
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  if (date.toDateString() === now.toDateString()) return time

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`

  const dayLabel = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  return `${dayLabel}, ${time}`
}
