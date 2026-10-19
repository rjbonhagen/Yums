import { afterEach, describe, expect, it, vi } from "vitest"
import { graduateLiveSource } from "./graduate-live"
import { ingestSource, sources } from "../index"

const event = {
  title: "Coffee &#038; Community", url: "https://grad.berkeley.edu/event/coffee/",
  utc_start_date: "2026-10-21 19:00:00", utc_end_date: "2026-10-21 20:00:00",
  description: "<p>Complimentary coffee &amp; snacks.</p>",
  venue: { venue: "Inclusive Excellence Hub" }, organizer: [{ organizer: "Graduate Assembly" }],
}
function response(events: unknown[], total_pages = 1) { return Response.json({ events, total_pages }) }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe("public Graduate Division calendar", () => {
  it("uses public sources by default and preserves dates, location, and food evidence", async () => {
    expect(sources.map((source) => source.key)).toEqual(["berkeley-live", "graduate-live"])
    const fetcher = vi.fn().mockResolvedValue(response([event]))
    vi.stubGlobal("fetch", fetcher)
    expect(await ingestSource(graduateLiveSource)).toEqual([expect.objectContaining({
      title: "Coffee & Community", organization: "Graduate Assembly", locationName: "Inclusive Excellence Hub",
      startTime: "2026-10-21T19:00:00Z", endTime: "2026-10-21T20:00:00Z",
      description: "Complimentary coffee & snacks.", confidenceScore: 0.9,
    })])
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error", headers: { Accept: "application/json" } })
  })
  it("uses Pacific bounds and reads each page without following publisher-provided URLs", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-19T02:00:00Z"))
    const fetcher = vi.fn().mockResolvedValueOnce(response([], 2)).mockResolvedValueOnce(response([event], 2))
    vi.stubGlobal("fetch", fetcher)
    expect(await graduateLiveSource.fetchEvents()).toHaveLength(1)
    const first = new URL(fetcher.mock.calls[0][0])
    expect(first.origin).toBe("https://grad.berkeley.edu")
    expect(Object.fromEntries(first.searchParams)).toMatchObject({ start_date: "2026-10-17", end_date: "2026-10-25", status: "publish", per_page: "100", page: "1" })
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("page")).toBe("2")
  })
  it("does not treat free admission, provided snacks, or food discussions as free-food evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
      { ...event, cost: "Free", description: "Snacks will be provided." },
      { ...event, description: "Discuss free food policy." },
      { ...event, description: "Tickets cost $20; lunch is free." },
    ])))
    expect(await ingestSource(graduateLiveSource)).toEqual([])
  })
  it("omits unsupported dates and unsafe event links without inventing locations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
      { ...event, url: "/event/coffee/?tracking=1#details", venue: [], organizer: [] },
      { ...event, url: "https://elsewhere.example/event/1" },
      { ...event, url: "javascript:alert(1)" },
      { ...event, utc_start_date: "2026-02-30 12:00:00" },
      { ...event, utc_start_date: undefined, start_date: "2026-10-21 12:00:00" },
      { ...event, utc_end_date: event.utc_start_date },
      { ...event, all_day: true }, { ...event, status: "private" }, null,
    ])))
    expect(await graduateLiveSource.fetchEvents()).toEqual([expect.objectContaining({
      sourceUrl: "https://grad.berkeley.edu/event/coffee/", locationName: undefined, organization: "Berkeley Graduate Division",
    })])
  })
  it.each([null, {}, { events: [] }, { events: {}, total_pages: 1 }, { events: [], total_pages: 5 }, { events: [event], total_pages: 0 }])(
    "discloses malformed or incomplete responses as unavailable", async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)))
      await expect(graduateLiveSource.fetchEvents()).rejects.toThrow(/Graduate Division calendar/)
    },
  )
  it("accepts a successful empty archive", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([], 0)))
    expect(await graduateLiveSource.fetchEvents()).toEqual([])
  })
  it("discloses login HTML and upstream failures", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("Sign in", { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
    vi.stubGlobal("fetch", fetcher)
    await expect(graduateLiveSource.fetchEvents()).rejects.toThrow("Invalid Graduate Division calendar response")
    await expect(graduateLiveSource.fetchEvents()).rejects.toThrow("Graduate Division calendar returned 503")
  })
})
