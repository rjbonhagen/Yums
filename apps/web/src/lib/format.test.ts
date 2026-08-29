import { describe, it, expect } from "vitest"
import { formatEventDateTime } from "./format"

const NOW = new Date("2026-08-29T12:00:00")

describe("formatEventDateTime", () => {
  it("returns empty string for missing input", () => {
    expect(formatEventDateTime(undefined, NOW)).toBe("")
  })

  it("shows only the time for an event happening today", () => {
    const result = formatEventDateTime("2026-08-29T18:00:00", NOW)
    expect(result).not.toMatch(/Tomorrow|Aug|Sat/)
    expect(result).toMatch(/6:00\s?PM/i)
  })

  it("labels an event tomorrow explicitly", () => {
    const result = formatEventDateTime("2026-08-30T18:00:00", NOW)
    expect(result).toMatch(/^Tomorrow, /)
  })

  it("shows a weekday/date for an event further out, not just a time", () => {
    const result = formatEventDateTime("2026-09-05T18:00:00", NOW)
    expect(result).not.toMatch(/^Tomorrow/)
    expect(result).toMatch(/Sep 5/)
    expect(result).toMatch(/6:00\s?PM/i)
  })
})
