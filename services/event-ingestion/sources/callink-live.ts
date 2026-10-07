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
    // Rounded to the current 2-minute bucket (matching the revalidate
    // window below) rather than the exact current instant — an exact
    // millisecond timestamp here would make every request's URL unique,
    // which defeats Next's fetch cache entirely (it keys on URL). Losing
    // events that start in the last couple minutes to this rounding is an
    // acceptable trade for actually being cacheable.
    const bucketMs = 2 * 60 * 1000
    const startsAfter = new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString()
    const params = new URLSearchParams({
      top: "100",
      startsAfter,
      "orderBy[0]": "startsOn asc",
    })

    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      // Club events don't change minute-to-minute; a short revalidate
      // window matches the pattern used for the other live sources.
      // cache:'force-cache' makes the opt-in explicit (Next's fetch
      // caching is opt-in per its docs) rather than relying on revalidate
      // alone.
      cache: "force-cache",
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      throw new Error(`callink.berkeley.edu returned ${res.status}`)
    }

    const body = (await res.json()) as CalLinkSearchResponse

    return body.value.map((e) => {
      const description = e.description ? stripHtml(e.description) : undefined
      const hasFreeFoodBenefit = e.benefitNames?.some((b) => b.trim().toLowerCase() === "free food") ?? false

      // benefitNames is Cal Link's own organizer-set tag, not a guess — fold
      // it into the description text so the existing keyword extractor
      // (services/event-ingestion/extract.ts) picks it up as a real signal
      // rather than adding a second, parallel confidence mechanism.
      const annotatedDescription = hasFreeFoodBenefit
        ? `${description ?? ""} Benefits: Free Food.`.trim()
        : description

      // Coordinates are present on some events (organizer-entered) and
      // absent on others — never guess when missing, same rule
      // berkeley-live.ts follows.
      const latitude = e.latitude ? Number(e.latitude) : undefined
      const longitude = e.longitude ? Number(e.longitude) : undefined

      return {
        organization: e.organizationName ?? "UC Berkeley student organization",
        title: e.name,
        description: annotatedDescription,
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
