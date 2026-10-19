import type { CampusEvent, CampusEventSource } from "../types"
import { normalizeSourceUrl } from "../source-url"
import { calendarText, campusDateOffset } from "./public-calendar"

const ORIGIN = "https://grad.berkeley.edu"

function utcDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return undefined
  const iso = `${value.replace(" ", "T")}Z`
  const time = Date.parse(iso)
  return Number.isFinite(time) && new Date(time).toISOString() === iso.replace("Z", ".000Z") ? iso : undefined
}

function normalizeEvent(value: unknown): CampusEvent[] {
  if (!value || typeof value !== "object") return []
  const event = value as Record<string, unknown>
  if (event.all_day === true || (event.status != null && event.status !== "publish")) return []
  const title = calendarText(event.title)
  const startTime = utcDate(event.utc_start_date)
  const endTime = utcDate(event.utc_end_date)
  const sourceUrl = normalizeSourceUrl(event.url, ORIGIN)
  if (!title || !startTime || !endTime || Date.parse(endTime) <= Date.parse(startTime) || !sourceUrl) return []
  const url = new URL(sourceUrl)
  if (url.origin !== ORIGIN || !url.pathname.startsWith("/event/")) return []
  url.search = ""
  url.hash = ""
  const venue = event.venue && typeof event.venue === "object" ? event.venue as Record<string, unknown> : {}
  const organizers = Array.isArray(event.organizer) ? event.organizer.flatMap((item) => {
    const name = item && typeof item === "object" ? calendarText(item.organizer) : ""
    return name ? [name] : []
  }) : []
  return [{
    title, description: calendarText(event.description) || undefined,
    organization: organizers.join(", ") || "Berkeley Graduate Division",
    locationName: calendarText(venue.venue) || undefined,
    startTime, endTime, sourceUrl: url.href,
  }]
}

export const graduateLiveSource: CampusEventSource = {
  key: "graduate-live",
  async fetchEvents(): Promise<CampusEvent[]> {
    const params = new URLSearchParams({
      start_date: campusDateOffset(-1), end_date: campusDateOffset(7), per_page: "100", status: "publish",
    })
    const events: CampusEvent[] = []
    let pages = 1
    for (let page = 1; page <= pages; page++) {
      params.set("page", String(page))
      const response = await fetch(`${ORIGIN}/wp-json/tribe/events/v1/events?${params}`, {
        headers: { Accept: "application/json" }, cache: "no-store",
        redirect: "error", signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error(`Graduate Division calendar returned ${response.status}`)
      if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        throw new Error("Invalid Graduate Division calendar response")
      }
      const body = await response.json() as { events?: unknown[]; total_pages?: number }
      if (!body || !Array.isArray(body.events) || body.events.length > 100) throw new Error("Invalid Graduate Division calendar response")
      if (!Number.isInteger(body.total_pages) || body.total_pages! < 0 || body.total_pages! > 4
        || (body.total_pages === 0 && body.events.length > 0)) throw new Error("Graduate Division calendar page limit exceeded")
      pages = Math.max(1, body.total_pages!)
      events.push(...body.events.flatMap(normalizeEvent))
    }
    return events
  },
}
