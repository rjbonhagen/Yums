import type { CampusEvent, CampusEventSource } from "../types"

/**
 * MOCK adapter. Stands in for a real UCSD event source (e.g. the campus
 * events calendar, AS club portal, or a department newsletter feed) until
 * that integration is built. Shape matches what a real adapter must return
 * so swapping this out is a drop-in change — see docs/data-sources.md.
 */
export const ucsdMockSource: CampusEventSource = {
  key: "ucsd-mock",
  async fetchEvents(): Promise<CampusEvent[]> {
    const today = new Date()
    const at = (hour: number, minute = 0) => {
      const d = new Date(today)
      d.setHours(hour, minute, 0, 0)
      return d.toISOString()
    }

    return [
      {
        organization: "ACM at UCSD",
        title: "ACM General Meeting",
        description: "Weekly meeting with free pizza for all attendees.",
        startTime: at(12, 30),
        endTime: at(13, 30),
        locationName: "CSE Building, Room 1202",
        latitude: 32.8815,
        longitude: -117.2344,
        sourceUrl: "https://acmucsd.com/events",
      },
      {
        organization: "Rady School of Management",
        title: "Entrepreneurship Speaker Series",
        description: "Guest speaker talk followed by boba and snacks.",
        startTime: at(16, 0),
        endTime: at(17, 0),
        locationName: "Rady School, Wells Fargo Hall",
        latitude: 32.8886,
        longitude: -117.2361,
        sourceUrl: "https://rady.ucsd.edu/events",
      },
      {
        organization: "ASUCSD",
        title: "Student Government Town Hall",
        description: "Open forum to discuss campus policy.",
        startTime: at(18, 0),
        endTime: at(19, 0),
        locationName: "Price Center Ballroom",
        sourceUrl: "https://as.ucsd.edu/events",
      },
    ]
  },
}
