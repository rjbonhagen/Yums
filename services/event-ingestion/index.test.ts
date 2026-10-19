import { afterEach, describe, expect, it, vi } from "vitest"
import { berkeleyLiveSource, berkeleyMockSource, graduateLiveSource, ingestAll, ingestSource, sources, type CampusEvent } from "./index"

afterEach(() => vi.restoreAllMocks())

describe("default event ingestion", () => {
  it("omits records without a valid event identity, time, or safe source link", async () => {
    const valid = { title: "Free pizza", organization: "Berkeley", startTime: "2026-10-07T20:00:00Z", sourceUrl: "https://events.berkeley.edu/event/1" }
    const result = await ingestSource({ key: "fixture", fetchEvents: async () => [
      valid, { ...valid, title: " " }, { ...valid, organization: "" },
      { ...valid, startTime: "invalid" }, { ...valid, sourceUrl: "javascript:alert(1)" }, null,
    ] as CampusEvent[] })
    expect(result.map((event) => event.sourceUrl)).toEqual([valid.sourceUrl])
  })
  it("uses only real adapters and never invokes the sample adapter", async () => {
    const sample = vi.spyOn(berkeleyMockSource, "fetchEvents").mockRejectedValue(new Error("samples must not be read"))
    vi.spyOn(berkeleyLiveSource, "fetchEvents").mockResolvedValue([{
      title: "Free pizza", organization: "Berkeley", startTime: "2026-10-07T20:00:00Z", sourceUrl: "https://events.berkeley.edu/event/1",
    }])
    vi.spyOn(graduateLiveSource, "fetchEvents").mockResolvedValue([{
      title: "Complimentary coffee", organization: "Student club", startTime: "2026-10-08T20:00:00Z", sourceUrl: "https://grad.berkeley.edu/event/coffee/",
    }])
    expect(sources.map((source) => source.key)).toEqual(["berkeley-live", "graduate-live"])
    expect((await ingestAll()).map((event) => event.title)).toEqual(["Free pizza", "Complimentary coffee"])
    expect(sample).not.toHaveBeenCalled()
  })
  it("reports a source failure instead of supplying sample replacements", async () => {
    const sample = vi.spyOn(berkeleyMockSource, "fetchEvents").mockResolvedValue([])
    vi.spyOn(berkeleyLiveSource, "fetchEvents").mockRejectedValue(new Error("source outage"))
    vi.spyOn(graduateLiveSource, "fetchEvents").mockResolvedValue([])
    await expect(ingestAll()).rejects.toThrow("source outage")
    expect(sample).not.toHaveBeenCalled()
  })
})
