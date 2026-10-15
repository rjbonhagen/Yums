import { describe, expect, it } from "vitest"
import { normalizeSourceUrl } from "./source-url"

describe("source web links", () => {
  it("retains complete web URLs and resolves publisher-relative links", () => {
    expect(normalizeSourceUrl("https://events.berkeley.edu/live/events/1?view=all")).toBe("https://events.berkeley.edu/live/events/1?view=all")
    expect(normalizeSourceUrl("/live/events/1", "https://events.berkeley.edu")).toBe("https://events.berkeley.edu/live/events/1")
    expect(normalizeSourceUrl("http://example.test/event")).toBe("http://example.test/event")
  })
  it("rejects unsafe protocols, embedded credentials, and malformed values", () => {
    for (const value of [undefined, null, 123, "", "/event", "javascript:alert(1)", "data:text/html,test", "file:///event", "https://user:secret@example.test/event", "https://example.test/\nevent", "https://example.test/" + "x".repeat(2048)]) {
      expect(normalizeSourceUrl(value)).toBeUndefined()
    }
  })
})
