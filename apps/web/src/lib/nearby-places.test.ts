import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchNearbyPlaces } from "./nearby-places"

function overpassResponse(elements: unknown[]) {
  return { ok: true, json: async () => ({ elements }) } as Response
}

describe("fetchNearbyPlaces", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("ignores a malformed mirror response when another mirror returns valid records", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: "bad response" }) } as Response)
      .mockResolvedValueOnce(overpassResponse([{ id: 1, lat: 37.87, lon: -122.26, tags: { name: "Real cafe", amenity: "cafe" } }]))
    expect((await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])).map((place) => place.name)).toEqual(["Real cafe"])
  })
  it("rejects malformed replies from both mirrors rather than reporting no places", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ error: "bad response" }) } as Response)
    await expect(fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])).rejects.toThrow("Invalid OpenStreetMap response")
  })

  it("maps a named OSM element to a NearbyPlace with real coordinates", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      overpassResponse([{ id: 1, lat: 37.87, lon: -122.26, tags: { name: "Caffé Strada", amenity: "cafe" } }]),
    )

    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])

    expect(places).toEqual([
      { id: "1", name: "Caffé Strada", category: "cafe", latitude: 37.87, longitude: -122.26, address: undefined },
    ])
    expect(vi.mocked(global.fetch).mock.calls.every(([, options]) =>
      options?.cache === "no-store",
    )).toBe(true)
  })

  it("filters out elements with no name tag rather than showing an unnamed place", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      overpassResponse([
        { id: 1, lat: 37.87, lon: -122.26, tags: { amenity: "cafe" } }, // no name
        { id: 2, lat: 37.87, lon: -122.26, tags: { name: "Named Place", amenity: "cafe" } },
      ]),
    )

    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])
    expect(places).toHaveLength(1)
    expect(places[0].name).toBe("Named Place")
  })

  it("builds a real street address from housenumber + street tags when present", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      overpassResponse([
        {
          id: 1,
          lat: 37.87,
          lon: -122.26,
          tags: { name: "Target", shop: "supermarket", "addr:housenumber": "2300", "addr:street": "Shattuck Ave" },
        },
      ]),
    )

    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22], ["supermarket"])
    expect(places[0].address).toBe("2300 Shattuck Ave")
  })

  it("defaults category to supermarket for elements tagged by shop rather than amenity", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      overpassResponse([{ id: 1, lat: 37.87, lon: -122.26, tags: { name: "Safeway", shop: "supermarket" } }]),
    )

    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22], ["supermarket"])
    expect(places[0].category).toBe("supermarket")
  })

  it("succeeds using the mirror when the primary Overpass endpoint fails", async () => {
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (String(url).includes("overpass-api.de")) throw new Error("primary down")
      return overpassResponse([{ id: 1, lat: 37.87, lon: -122.26, tags: { name: "Mirror Place", amenity: "cafe" } }])
    })

    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])
    expect(places).toHaveLength(1)
    expect(places[0].name).toBe("Mirror Place")
  })

  it.each(["overpass-api.de", "overpass.kumi.systems"])("returns a valid response without waiting for the slower %s endpoint", async (slowHost) => {
    let slowSignal: AbortSignal | undefined
    vi.mocked(global.fetch).mockImplementation(async (url, options) => {
      if (String(url).includes(slowHost)) {
        slowSignal = options?.signal ?? undefined
        return new Promise<Response>((_, reject) => {
          slowSignal?.addEventListener("abort", () => reject(new Error("cancelled slower request")), { once: true })
        })
      }
      return overpassResponse([{ id: 1, lat: 37.87, lon: -122.26, tags: { name: "Available cafe", amenity: "cafe" } }])
    })
    const places = await fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])
    expect(places[0].name).toBe("Available cafe")
    expect(slowSignal?.aborted).toBe(true)
  }, 1000)

  it("throws (never returns fabricated data) when both Overpass endpoints fail", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("both endpoints down"))

    await expect(fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])).rejects.toThrow()
  })

  it("throws when Overpass responds with a non-ok status on both endpoints", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    await expect(fetchNearbyPlaces([37.83, -122.3, 37.9, -122.22])).rejects.toThrow()
  })
})
