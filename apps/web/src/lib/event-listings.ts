import type { Recommendation } from "@yums/shared"
import { savedKey } from "./save-identity"

function listingDetails(item: Recommendation) {
  const [organizer, ...venue] = (item.subtitle ?? "").split(" · ")
  const identity = item.seriesKey?.split("::")[0] ?? organizer
  const start = Date.parse(item.startTime ?? "")
  const end = Date.parse(item.endTime ?? "")
  let host = ""
  try {
    const url = new URL(item.sourceUrl ?? "")
    if (url.protocol === "https:" && !url.username && !url.password) host = url.hostname
  } catch { /* Listings without a publisher link stay separate. */ }
  const canMatch = item.kind === "free_food" && item.seriesKey && venue.join(" · ").trim()
    && ["callink.berkeley.edu", "events.berkeley.edu", "grad.berkeley.edu"].includes(host)
    && Number.isFinite(start) && Number.isFinite(end) && end > start && !item.durationEstimated
  return {
    key: canMatch ? JSON.stringify([item.title.trim().toLowerCase(), venue.join(" · ").trim().toLowerCase(), start, end]) : item.id,
    organizer: identity.trim().toLowerCase(), host,
    publisher: ["UC Berkeley Events Calendar", "Berkeley Graduate Division"].includes(organizer),
  }
}

export function collapseDuplicateListings(items: Recommendation[], saves: Map<string, string>): Recommendation[] {
  const groups = new Map<string, Recommendation[]>()
  for (const item of items) {
    const { key } = listingDetails(item)
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap((group) => {
    if (group.length < 2) return group
    const details = group.map(listingDetails)
    if (details.some((a) => details.some((b) => a.organizer !== b.organizer
      && !(a.host !== b.host && (a.publisher || b.publisher))))) return group
    const located = group.filter((item) => item.latitude != null && item.longitude != null)
    if (located.some((item) => item.latitude !== located[0].latitude || item.longitude !== located[0].longitude)) return group
    const sorted = [...group].sort((a, b) => (a.sourceUrl ?? "").localeCompare(b.sourceUrl ?? ""))
    const chosen = sorted.find((item) => saves.has(savedKey(item))) ?? located[0] ?? sorted[0]
    const location = located[0] ?? chosen
    return [{ ...chosen, latitude: location.latitude, longitude: location.longitude,
      distanceMinutes: location.distanceMinutes, distanceEstimated: location.distanceEstimated }]
  })
}
