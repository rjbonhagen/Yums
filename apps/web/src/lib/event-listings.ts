import type { Recommendation } from "@yums/shared"
import { savedKey } from "./save-identity"

export function collapseDuplicateListings(items: Recommendation[], saves: Map<string, string>): Recommendation[] {
  const groups = new Map<string, Recommendation[]>()
  for (const item of items) {
    const start = Date.parse(item.startTime ?? "")
    const end = Date.parse(item.endTime ?? "")
    const canMatch = item.kind === "free_food" && item.seriesKey && item.subtitle?.includes(" · ")
      && /^https:\/\/callink\.berkeley\.edu\/event\/\d+$/.test(item.sourceUrl ?? "")
      && Number.isFinite(start) && Number.isFinite(end)
    const key = canMatch ? JSON.stringify([item.seriesKey, item.title.trim(), item.subtitle?.trim(), start, end]) : item.id
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap((group) => {
    if (group.length < 2) return group
    const located = group.filter((item) => item.latitude != null && item.longitude != null)
    if (located.some((item) => item.latitude !== located[0].latitude || item.longitude !== located[0].longitude)) return group
    const sorted = [...group].sort((a, b) => (a.sourceUrl ?? "").localeCompare(b.sourceUrl ?? ""))
    const chosen = sorted.find((item) => saves.has(savedKey(item))) ?? located[0] ?? sorted[0]
    const location = located[0] ?? chosen
    return [{ ...chosen, latitude: location.latitude, longitude: location.longitude,
      distanceMinutes: location.distanceMinutes, distanceEstimated: location.distanceEstimated }]
  })
}
