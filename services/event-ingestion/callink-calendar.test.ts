import { describe, expect, it } from "vitest"
import { calLinkEventUrl, MAX_CALENDAR_BYTES, parseCalLinkCalendar } from "./callink-calendar"

const now = new Date("2026-10-17T19:00:00Z")
function event(extra = "", id = "123") {
  return `BEGIN:VEVENT\r\nUID:https://callink.berkeley.edu/event/${id}\r\nURL:https://callink.berkeley.edu/event/${id}\r\nSUMMARY:Club evening\r\nDTSTART:20261030T023000Z\r\nDTEND:20261030T043000Z\r\nLOCATION:MLK\\, Activity Zone\r\nX-HOSTS:Student Union\r\n${extra}\r\nEND:VEVENT`
}
function calendar(...events: string[]) { return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join("\r\n")}\r\nEND:VCALENDAR` }

describe("private Cal Link calendar imports", () => {
  it("reads folded, escaped text and keeps the source's UTC times", () => {
    const result = parseCalLinkCalendar(calendar(event("DESCRIPTION:Free pizza\\, snacks\\nBring\r\n  a friend")), now)
    expect(result.events[0]).toMatchObject({ title: "Club evening", organization: "Student Union", locationName: "MLK, Activity Zone",
      description: "Free pizza, snacks\nBring a friend", startTime: "2026-10-30T02:30:00.000Z", endTime: "2026-10-30T04:30:00.000Z", foodEvidence: true })
  })
  it("does not infer free food from free admission or generic treats", () => {
    expect(parseCalLinkCalendar(calendar(event("CATEGORIES:Free\r\nDESCRIPTION:Games and spooky treats")), now).events[0].foodEvidence).toBe(false)
    expect(parseCalLinkCalendar(calendar(event("CATEGORIES:Free Food")), now).events[0].foodEvidence).toBe(true)
    expect(parseCalLinkCalendar(calendar(event("CATEGORIES:Free Food\r\nDESCRIPTION:No free food available")), now).events[0].foodEvidence).toBe(false)
  })
  it("omits past or cancelled events and preserves an ongoing event", () => {
    expect(parseCalLinkCalendar(calendar(event("STATUS:CANCELLED")), now).events).toEqual([])
    expect(parseCalLinkCalendar(calendar(event()), new Date("2026-10-30T03:00:00Z")).events).toHaveLength(1)
    expect(parseCalLinkCalendar(calendar(event()), new Date("2026-10-30T05:00:00Z")).events).toEqual([])
  })
  it("keeps recurring occurrences separate but collapses duplicate exports", () => {
    const next = event().replaceAll("20261030", "20261106")
    const result = parseCalLinkCalendar(calendar(event(), event(), next), now)
    expect(result.events).toHaveLength(2)
    expect(result.skipped).toBe(1)
  })
  it("rejects recurrence rules, all-day events, floating times, and impossible dates", () => {
    const cases = [event("RRULE:FREQ=DAILY"), event().replace("DTSTART:20261030T023000Z", "DTSTART;VALUE=DATE:20261030"),
      event().replace("DTSTART:20261030T023000Z", "DTSTART:20261030T023000"), event().replace("20261030T023000Z", "20260230T023000Z"),
      event().replace("DTEND:20261030T043000Z", "DTEND:20261030T013000Z")]
    for (const candidate of cases) expect(parseCalLinkCalendar(calendar(candidate), now).events).toEqual([])
  })
  it("accepts only canonical Cal Link event links and never follows attachments", () => {
    expect(calLinkEventUrl("https://callink.berkeley.edu/event/123?tracking=yes#details")).toBe("https://callink.berkeley.edu/event/123")
    for (const url of ["javascript:alert(1)", "https://callink.berkeley.edu.evil.test/event/123", "https://name:pass@callink.berkeley.edu/event/123", "http://callink.berkeley.edu/event/123"]) {
      expect(calLinkEventUrl(url)).toBeNull()
    }
    expect(parseCalLinkCalendar(calendar(event("ATTACH:https://example.com/file")), now).events).toHaveLength(1)
    expect(parseCalLinkCalendar(calendar(event().replaceAll("https://callink.berkeley.edu/event/123", "https://example.com/event/123")), now).events).toEqual([])
  })
  it("bounds file size and record count, and rejects malformed input", () => {
    expect(() => parseCalLinkCalendar("x".repeat(MAX_CALENDAR_BYTES + 1), now)).toThrow("512 KB")
    expect(() => parseCalLinkCalendar(calendar(...Array.from({ length: 251 }, (_, i) => event("", String(i)))), now)).toThrow("250 events")
    expect(() => parseCalLinkCalendar("<html>Sign in</html>", now)).toThrow("could not be read")
    expect(() => parseCalLinkCalendar(calendar(), now)).toThrow("no events")
  })
})
