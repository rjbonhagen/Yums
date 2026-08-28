import type { CampusEvent, CampusEventSource } from "../types"

// UC Berkeley's public events calendar (events.berkeley.edu, an OU Campus
// "LiveWhale" calendar) exposes an unauthenticated JSON feed at this path.
// Confirmed by hand: /live/json/events/?days=1&pp=100 returns today's
// events with id/title/url/date_iso/date2_iso/timezone. No description or
// location fields come back from this endpoint despite them being listed
// under "supported_fields" in the response meta — every documented query
// param combination we tried (fields[]=, fields=, bare booleans) left
// meta.response_fields empty. So this adapter is honest about what it
// actually has: real titles/times/URLs, no venue or description text.
// locationName is intentionally omitted rather than guessed.
const LIVE_FEED_URL = "https://events.berkeley.edu/live/json/events/?days=1&pp=100"

interface LiveWhaleEvent {
  id: number
  title: string
  url: string
  date_iso: string
  date2_iso?: string
}

interface LiveWhaleResponse {
  data: LiveWhaleEvent[]
}

export const berkeleyLiveSource: CampusEventSource = {
  key: "berkeley-live",
  async fetchEvents(): Promise<CampusEvent[]> {
    const res = await fetch(LIVE_FEED_URL, {
      headers: { Accept: "application/json" },
      // Real calendar data changes throughout the day; don't cache stale results.
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`events.berkeley.edu returned ${res.status}`)
    }

    const body = (await res.json()) as LiveWhaleResponse

    return body.data.map((e) => ({
      organization: "UC Berkeley Events Calendar",
      title: e.title,
      startTime: e.date_iso,
      endTime: e.date2_iso,
      sourceUrl: e.url,
    }))
  },
}
