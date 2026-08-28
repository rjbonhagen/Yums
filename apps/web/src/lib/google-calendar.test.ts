import { describe, expect, it } from "vitest"
import { scheduleScoreFromBusyIntervals, type BusyInterval } from "./google-calendar"

describe("scheduleScoreFromBusyIntervals", () => {
  it("scores an event high when there's no overlapping busy block", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T18:00:00Z", end: "2026-09-01T19:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("scores an event low when it's fully inside a busy block", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T12:00:00Z", end: "2026-09-01T14:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:30:00Z"),
      new Date("2026-09-01T13:30:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("scores low on a partial overlap (event starts mid-busy-block)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T12:00:00Z", end: "2026-09-01T13:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:30:00Z"),
      new Date("2026-09-01T14:00:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("treats a busy block that ends exactly when the event starts as free (half-open interval)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T11:00:00Z", end: "2026-09-01T12:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("treats a busy block that starts exactly when the event ends as free (half-open interval)", () => {
    const busy: BusyInterval[] = [{ start: "2026-09-01T13:00:00Z", end: "2026-09-01T14:00:00Z" }]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })

  it("checks overlap against every busy interval, not just the first", () => {
    const busy: BusyInterval[] = [
      { start: "2026-09-01T08:00:00Z", end: "2026-09-01T09:00:00Z" },
      { start: "2026-09-01T12:00:00Z", end: "2026-09-01T13:00:00Z" },
    ]
    const score = scheduleScoreFromBusyIntervals(
      busy,
      new Date("2026-09-01T12:15:00Z"),
      new Date("2026-09-01T12:45:00Z"),
    )
    expect(score).toBe(0.1)
  })

  it("scores high when there are no busy intervals at all", () => {
    const score = scheduleScoreFromBusyIntervals(
      [],
      new Date("2026-09-01T12:00:00Z"),
      new Date("2026-09-01T13:00:00Z"),
    )
    expect(score).toBe(1.0)
  })
})
