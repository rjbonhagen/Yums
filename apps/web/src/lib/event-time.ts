export const CAMPUS_TIME_ZONE = "America/Los_Angeles"

export function campusDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)!.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function addCalendarDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function eventEnd(startTime: string, endTime?: string): { date: Date; estimated: boolean } {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null
  if (end && Number.isFinite(end.getTime()) && end > start) return { date: end, estimated: false }
  return { date: new Date(start.getTime() + 60 * 60 * 1000), estimated: true }
}

export function isInCampusWeek(startTime: string, endTime: string | undefined, now = new Date()): boolean {
  const start = new Date(startTime)
  if (!Number.isFinite(start.getTime())) return false
  const end = eventEnd(startTime, endTime).date
  const today = campusDate(now)
  return end > now && campusDate(start) < addCalendarDays(today, 7)
}

export function isToday(startTime: string | undefined, now = new Date(), endTime?: string): boolean {
  if (!startTime) return false
  const date = new Date(startTime)
  return Number.isFinite(date.getTime()) && (campusDate(date) === campusDate(now) || (date < now && eventEnd(startTime, endTime).date > now))
}
