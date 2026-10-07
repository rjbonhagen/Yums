import type { CampusEvent, CampusEventSource } from "../types"

// UC Berkeley's official student-org platform (Cal Link, a CampusGroups
// instance) exposes a real, public, unauthenticated JSON API for club
// events — confirmed by hand: GET /api/discovery/event/search returns
// real titles, HTML descriptions, start/end times, location names, and
// (when the organizer provided them) coordinates. Unlike
// events.berkeley.edu (see berkeley-live.ts), this feed also returns a
// `benefitNames` tag array that organizers can set themselves, including
// a literal "Free Food" tag on many events — a real, attributable signal
// distinct from guessing off keywords, so we fold it into the description
// text handed to extractDeterministic rather than inventing a separate
// confidence path.
const SEARCH_URL = "https://callink.berkeley.edu/api/discovery/event/search"

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
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      throw new Error(`callink.berkeley.edu returned ${res.status}`)
    }

    const body = (await res.json()) as CalLinkSearchResponse

    return body.value.map((e) => {
      const description = e.description ? stripHtml(e.description) : undefined
      const hasFreeFoodBenefit = e.benefitNames?.some((b) => b.trim().toLowerCase() === "free food") ?? false

      // Keep organizer evidence separate from description text so a
      // withdrawn offer can override a stale benefit tag.

      // Coordinates are present on some events (organizer-entered) and
      // absent on others — never guess when missing, same rule
      // berkeley-live.ts follows.
      const latitude = e.latitude ? Number(e.latitude) : undefined
      const longitude = e.longitude ? Number(e.longitude) : undefined

      return {
        organization: e.organizationName ?? "UC Berkeley student organization",
        title: e.name,
        description,
        startTime: e.startsOn,
        endTime: e.endsOn,
        locationName: e.location?.trim() || undefined,
        latitude: latitude != null && !Number.isNaN(latitude) ? latitude : undefined,
        longitude: longitude != null && !Number.isNaN(longitude) ? longitude : undefined,
        sourceUrl: `https://callink.berkeley.edu/event/${e.id}`,
        freeFoodConfirmed: hasFreeFoodBenefit,
      }
    })
  },
}
