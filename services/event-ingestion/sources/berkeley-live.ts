import type { CampusEvent, CampusEventSource } from "../types"
import { normalizeSourceUrl } from "../source-url"

interface LiveWhaleEvent {
  id: number
  title: string
  url: string
  date_iso: string
  date2_iso?: string
  description?: string
  location?: string
}
interface LiveWhaleResponse {
  data: LiveWhaleEvent[]
  meta?: { total_pages?: number }
}
function windowDate(offset: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
function plainText(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim()
}
export const berkeleyLiveSource: CampusEventSource = {
  key: "berkeley-live",
  async fetchEvents(): Promise<CampusEvent[]> {
    // LiveWhale uses path parameters. Query-string days/pp were ignored.
    const url = `https://events.berkeley.edu/live/json/events/start_date/${windowDate(-1)}/end_date/${windowDate(7)}/paginate/1000/response_fields/description,location/`
    const events: LiveWhaleEvent[] = []
    let pages = 1
    for (let page = 1; page <= pages; page++) {
      const res = await fetch(`${url}?page=${page}`, {
        headers: { Accept: "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`events.berkeley.edu returned ${res.status}`)
      const body = (await res.json()) as LiveWhaleResponse
      if (!body || !Array.isArray(body.data)) throw new Error("Invalid Berkeley event response")
      pages = body.meta?.total_pages ?? 1
      if (!Number.isInteger(pages) || pages < 1 || pages > 4) throw new Error("Berkeley event page limit exceeded")
      events.push(...body.data)
    }
    return events.flatMap((e) => {
      if (!e || typeof e.title !== "string" || typeof e.date_iso !== "string") return []
      const sourceUrl = normalizeSourceUrl(e.url, "https://events.berkeley.edu")
      if (!sourceUrl) return []
      return [{
      organization: "UC Berkeley Events Calendar", title: plainText(e.title),
      description: e.description ? plainText(e.description) : undefined,
      locationName: e.location ? plainText(e.location) : undefined,
      startTime: e.date_iso, endTime: e.date2_iso, sourceUrl,
      }]
    })
  },
}
