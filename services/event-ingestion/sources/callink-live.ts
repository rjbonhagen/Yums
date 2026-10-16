import type { CampusEvent, CampusEventSource } from "../types"

// Cal Link's event discovery feed may require CalNet sign-in. Read only
// public JSON responses; sign-in redirects are disclosed to the caller.
const SEARCH_URL = "https://callink.berkeley.edu/api/discovery/event/search"

export class CalLinkSignInRequiredError extends Error {
  constructor() {
    super("Cal Link requires Berkeley CalNet sign-in.")
    this.name = "CalLinkSignInRequiredError"
  }
}

interface CalLinkEvent {
  id: string
  name: string
  description?: string
  location?: string
  organizationName?: string
  startsOn: string
  endsOn?: string
  latitude?: string
  longitude?: string
  benefitNames?: string[]
}

interface CalLinkSearchResponse {
  value: CalLinkEvent[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

export const callinkSource: CampusEventSource = {
  key: "callink-live",
  async fetchEvents(): Promise<CampusEvent[]> {
    // Include recently started events; the recommendation layer uses real
    // end times to discard expired offers. Round the query time to reduce
    // needless URL variations; recommendation caching is handled separately.
    const bucketMs = 2 * 60 * 1000
    const startsAfter = new Date(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / bucketMs) * bucketMs).toISOString()
    const params = new URLSearchParams({
      top: "100",
      startsAfter,
      "orderBy[0]": "startsOn asc",
    })

    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      // The outer recommendation cache must refresh from the network.
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    })

    const location = res.headers.get("location")
    if (res.status === 401 || (res.status >= 300 && res.status < 400 && location
      && new URL(location, SEARCH_URL).origin === "https://callink.berkeley.edu"
      && new URL(location, SEARCH_URL).pathname.toLowerCase() === "/account/login")) {
      throw new CalLinkSignInRequiredError()
    }
    if (!res.ok) {
      throw new Error(`callink.berkeley.edu returned ${res.status}`)
    }
    if (!res.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new Error("Invalid Cal Link event response")
    }
    const body = await res.json().catch(() => { throw new Error("Invalid Cal Link event response") }) as CalLinkSearchResponse
    if (!body || !Array.isArray(body.value)) throw new Error("Invalid Cal Link event response")

    return body.value.flatMap((e) => {
      if (!e || !["string", "number"].includes(typeof e.id)
        || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(e.id))) return []
      const description = e.description ? stripHtml(e.description) : undefined
      const hasFreeFoodBenefit = e.benefitNames?.some((b) => b.trim().toLowerCase() === "free food") ?? false

      // Keep organizer evidence separate from description text so a
      // withdrawn offer can override a stale benefit tag.

      // Coordinates are present on some events (organizer-entered) and
      // absent on others — never guess when missing, same rule
      // berkeley-live.ts follows.
      const latitude = e.latitude ? Number(e.latitude) : undefined
      const longitude = e.longitude ? Number(e.longitude) : undefined

      return [{
        organization: e.organizationName ?? "UC Berkeley student organization",
        title: e.name,
        description,
        startTime: e.startsOn,
        endTime: e.endsOn,
        locationName: e.location?.trim() || undefined,
        latitude: latitude != null && !Number.isNaN(latitude) ? latitude : undefined,
        longitude: longitude != null && !Number.isNaN(longitude) ? longitude : undefined,
        sourceUrl: `https://callink.berkeley.edu/event/${encodeURIComponent(e.id)}`,
        freeFoodConfirmed: hasFreeFoodBenefit,
      }]
    })
  },
}
