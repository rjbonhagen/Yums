import type { CampusEvent, CampusEventSource } from "../types"

/**
 * MOCK adapter. Stands in for a real UC Berkeley event source (e.g. the
 * campus events calendar, ASUC club portal, or a department newsletter
 * feed) until that integration is built. Shape matches what a real adapter
 * must return so swapping this out is a drop-in change — see
 * docs/data-sources.md.
 */
export const berkeleyMockSource: CampusEventSource = {
  key: "berkeley-mock",
  async fetchEvents(): Promise<CampusEvent[]> {
    const today = new Date()
    const at = (hour: number, minute = 0) => {
      const d = new Date(today)
      d.setHours(hour, minute, 0, 0)
      return d.toISOString()
    }

    return [
      {
        organization: "ACM at UC Berkeley",
        title: "ACM General Meeting",
        description: "Weekly meeting with free pizza for all attendees.",
        startTime: at(12, 30),
        endTime: at(13, 30),
        locationName: "Soda Hall, Wozniak Lounge",
        latitude: 37.8752,
        longitude: -122.2585,
        sourceUrl: "https://acmatberkeley.org/events",
      },
      {
        organization: "Haas Undergraduate Business Association",
        title: "Entrepreneurship Speaker Series",
        description: "Guest speaker talk followed by boba and snacks.",
        startTime: at(16, 0),
        endTime: at(17, 0),
        locationName: "Haas School of Business, Spieker Forum",
        latitude: 37.8698,
        longitude: -122.2599,
        sourceUrl: "https://haas.berkeley.edu/events",
      },
      {
        organization: "ASUC",
        title: "Student Government Town Hall",
        description: "Open forum to discuss campus policy.",
        startTime: at(18, 0),
        endTime: at(19, 0),
        locationName: "MLK Jr. Student Union",
        sourceUrl: "https://asuc.org/events",
      },
    ]
  },
}
