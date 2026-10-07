import { describe, expect, it } from "vitest"
import { campusDate, eventEnd, isInCampusWeek, isToday } from "./event-time"

describe("campus event windows", () => {
  const now = new Date("2026-10-07T06:30:00Z") // Oct 6, 11:30pm at Berkeley
  it("uses Berkeley's date rather than UTC or the host timezone", () => {
    expect(campusDate(now)).toBe("2026-10-06")
    expect(isToday("2026-10-07T06:45:00Z", now)).toBe(true)
    expect(isToday("2026-10-07T07:15:00Z", now)).toBe(false)
  })
  it("keeps ongoing events and excludes ended events", () => {
    expect(isInCampusWeek("2026-10-07T06:00:00Z", "2026-10-07T07:00:00Z", now)).toBe(true)
    expect(isInCampusWeek("2026-10-07T05:00:00Z", "2026-10-07T06:30:00Z", now)).toBe(false)
  })
  it("includes only today and the next six campus dates", () => {
    expect(isInCampusWeek("2026-10-13T06:59:00Z", undefined, now)).toBe(true)
    expect(isInCampusWeek("2026-10-13T07:00:00Z", undefined, now)).toBe(false)
  })
  it("handles the repeated hour when daylight saving time ends", () => {
    const fallBack = new Date("2026-11-01T08:30:00Z")
    expect(isToday("2026-11-01T09:30:00Z", fallBack)).toBe(true)
    expect(isInCampusWeek("2026-11-08T07:59:00Z", undefined, fallBack)).toBe(true)
    expect(isInCampusWeek("2026-11-08T08:00:00Z", undefined, fallBack)).toBe(false)
  })
  it("handles the skipped hour when daylight saving time begins", () => {
    const spring = new Date("2026-03-08T09:30:00Z")
    expect(isToday("2026-03-08T10:30:00Z", spring)).toBe(true)
    expect(isInCampusWeek("2026-03-15T06:59:00Z", undefined, spring)).toBe(true)
    expect(isInCampusWeek("2026-03-15T07:00:00Z", undefined, spring)).toBe(false)
  })
  it("preserves real durations and discloses invalid/missing duration fallback", () => {
    expect(eventEnd("2026-10-07T06:00:00Z", "2026-10-07T08:00:00Z")).toEqual({ date: new Date("2026-10-07T08:00:00Z"), estimated: false })
    expect(eventEnd("2026-10-07T06:00:00Z", "invalid")).toEqual({ date: new Date("2026-10-07T07:00:00Z"), estimated: true })
    expect(isInCampusWeek("invalid", undefined, now)).toBe(false)
  })
})
