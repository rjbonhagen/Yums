import ICAL from "ical.js"
import { extractDeterministic } from "./extract"

export const MAX_CALENDAR_BYTES = 512 * 1024
const MAX_EVENTS = 250
type Component = InstanceType<typeof ICAL.Component>

export interface ImportedCalLinkEvent {
  id: string
  title: string
  description?: string
  locationName?: string
  organization: string
  startTime: string
  endTime?: string
  sourceUrl: string
  foodEvidence: boolean
}

export function calLinkEventUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (url.origin !== "https://callink.berkeley.edu" || url.username || url.password
      || !/^\/event\/\d{1,20}$/.test(url.pathname)) return null
    return `${url.origin}${url.pathname}`
  } catch { return null }
}

function text(component: Component, name: string, limit: number): string | undefined {
  const value = component.getFirstPropertyValue(name)
  return typeof value === "string" ? value.trim().slice(0, limit) || undefined : undefined
}

function utcDate(component: Component, name: string): string | undefined {
  const property = component.getFirstProperty(name)
  if (!property) return undefined
  const data = property.toJSON() as unknown[]
  const value = data[3]
  if (data[2] !== "date-time" || typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return undefined
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString().replace(".000Z", "Z") !== value) return undefined
  return date.toISOString()
}

export function parseCalLinkCalendar(input: string, now = new Date()): { events: ImportedCalLinkEvent[]; skipped: number } {
  if (new TextEncoder().encode(input).length > MAX_CALENDAR_BYTES) throw new Error("Choose a calendar export smaller than 512 KB.")
  let calendar: Component
  try {
    calendar = new ICAL.Component(ICAL.parse(input.trim()))
  } catch { throw new Error("This file could not be read. Choose Cal Link’s iCal/Outlook export.") }
  if (calendar.name !== "vcalendar") throw new Error("Choose a Cal Link calendar export ending in .ics.")
  const entries = calendar.getAllSubcomponents("vevent")
  if (!entries.length) throw new Error("This calendar export has no events.")
  if (entries.length > MAX_EVENTS) throw new Error("Choose an export with 250 events or fewer.")
  const events = new Map<string, ImportedCalLinkEvent>()
  let skipped = 0
  for (const entry of entries) {
    const title = text(entry, "summary", 160)
    const startTime = utcDate(entry, "dtstart")
    const endTime = utcDate(entry, "dtend")
    const sourceUrl = calLinkEventUrl(text(entry, "url", 2048)) ?? calLinkEventUrl(text(entry, "uid", 2048))
    if (!title || !sourceUrl || !startTime || entry.hasProperty("rrule") || entry.hasProperty("recurrence-id")
      || entry.hasProperty("rdate") || entry.hasProperty("exdate")
      || text(calendar, "method", 30)?.toUpperCase() === "CANCEL"
      || text(entry, "status", 30)?.toUpperCase() === "CANCELLED"
      || (entry.hasProperty("dtend") && (!endTime || endTime <= startTime))
      || Date.parse(endTime ?? startTime) <= now.getTime()) {
      skipped++
      continue
    }
    const description = text(entry, "description", 4000)
    const organization = text(entry, "x-hosts", 160) ?? "Cal Link event"
    const categoryFood = entry.getAllProperties("categories").some((property) => property.getValues()
      .some((value) => typeof value === "string" && value.trim().toLowerCase() === "free food"))
    const foodEvidence = extractDeterministic({ title, description, organization, startTime, sourceUrl,
      freeFoodConfirmed: categoryFood }).confidenceScore > 0
    const event = { id: `${sourceUrl}:${startTime}`, title, description, organization, startTime, endTime,
      sourceUrl, foodEvidence, locationName: text(entry, "location", 160) }
    if (events.has(event.id)) skipped++
    else events.set(event.id, event)
  }
  return { events: [...events.values()].sort((a, b) => a.startTime.localeCompare(b.startTime)), skipped }
}
