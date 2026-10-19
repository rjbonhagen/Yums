export function campusDateOffset(offset: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function calendarText(value: unknown): string {
  if (typeof value !== "string") return ""
  const entities: Record<string, string> = {
    amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">",
    rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—",
  }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " "
  }).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}
