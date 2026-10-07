// Shared date/time formatting for event cards (recommendations-view.tsx,
// dashboard/page.tsx). Berkeley's calendar feed only returns today's
// events (see services/event-ingestion/sources/berkeley-live.ts), but
// Cal Link has no upper bound and can return events days/weeks out (see
// callink-live.ts) — showing only a time with no date is misleading for
// those, so this always makes "not today" explicit.
import { CAMPUS_TIME_ZONE, campusDate, addCalendarDays } from "./event-time"

export function formatEventDateTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return "Time unavailable"
  const time = date.toLocaleTimeString("en-US", { timeZone: CAMPUS_TIME_ZONE, hour: "numeric", minute: "2-digit" })

  if (campusDate(date) === campusDate(now)) return time

  if (campusDate(date) === addCalendarDays(campusDate(now), 1)) return `Tomorrow, ${time}`

  const dayLabel = date.toLocaleDateString("en-US", { timeZone: CAMPUS_TIME_ZONE, weekday: "short", month: "short", day: "numeric" })
  return `${dayLabel}, ${time}`
}
