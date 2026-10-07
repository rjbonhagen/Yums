import { afterEach, describe, expect, it, vi } from "vitest"
import { berkeleyLiveSource } from "./berkeley-live"
import { callinkSource } from "./callink-live"

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe("live source coverage", () => {
  it("resolves Berkeley relative links and omits unsafe source URLs", async () => {
    const event = { id: 1, title: "Free pizza", date_iso: "2026-10-07T20:00:00Z" }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { ...event, url: "/live/events/1" }, { ...event, url: "javascript:alert(1)" },
    ] }) }))
    expect((await berkeleyLiveSource.fetchEvents()).map((event) => event.sourceUrl)).toEqual(["https://events.berkeley.edu/live/events/1"])
  })
  it("rejects a malformed Cal Link response rather than reporting a successful empty feed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: "bad response" }) }))
    await expect(callinkSource.fetchEvents()).rejects.toThrow("Invalid Cal Link event response")
  })
  it("does not create event links from absent or invalid Cal Link IDs", async () => {
    const event = { name: "Free pizza", startsOn: "2026-10-07T20:00:00Z" }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: [
      { ...event, id: 123 }, { ...event }, { ...event, id: "../other" },
    ] }) }))
    expect((await callinkSource.fetchEvents()).map((event) => event.sourceUrl)).toEqual(["https://callink.berkeley.edu/event/123"])
  })
  it("uses Pacific dates and documented path parameters for the weekly feed", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-08T01:00:00Z"))
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal("fetch", fetcher)
    await berkeleyLiveSource.fetchEvents()
    const url = new URL(fetcher.mock.calls[0][0])
    expect(url.pathname).toContain("/start_date/2026-10-06/end_date/2026-10-14/")
    expect(url.pathname).toContain("/paginate/1000/response_fields/description,location/")
  })

  it("reads remaining pages and preserves description evidence and venue", async () => {
    const event = { id: 1, title: "Campus gathering", url: "https://events.berkeley.edu/1",
      date_iso: "2026-10-07T20:00:00Z", description: "<p>Complimentary pizza &amp; drinks</p>", location: "Soda Hall" }
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [], meta: { total_pages: 2 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [event], meta: { total_pages: 2 } }) })
    vi.stubGlobal("fetch", fetcher)
    const [result] = await berkeleyLiveSource.fetchEvents()
    expect(fetcher.mock.calls[1][0]).toContain("?page=2")
    expect(result.description).toBe("Complimentary pizza & drinks")
    expect(result.locationName).toBe("Soda Hall")
  })

  it("includes recently started Cal Link events and preserves their end times", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-07T20:01:30Z"))
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ value: [{
      id: "ongoing", name: "Free pizza social", startsOn: "2026-10-07T19:00:00Z",
      endsOn: "2026-10-07T21:00:00Z", benefitNames: ["Free Food"],
    }] }) })
    vi.stubGlobal("fetch", fetcher)
    const [event] = await callinkSource.fetchEvents()
    const lowerBound = new URL(fetcher.mock.calls[0][0]).searchParams.get("startsAfter")!
    expect(new Date(lowerBound).getTime()).toBeLessThan(new Date(event.startTime).getTime())
    expect(event.endTime).toBe("2026-10-07T21:00:00Z")
    expect(event.freeFoodConfirmed).toBe(true)
  })
})
