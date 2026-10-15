import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ cookie: undefined as string | undefined, configured: false, user: null as { id: string } | null, load: vi.fn() }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => mocks.cookie ? { value: mocks.cookie } : undefined }) }))
vi.mock("./supabase/client", () => ({ isSupabaseConfigured: () => mocks.configured }))
vi.mock("./supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }))
vi.mock("./preferences", async (original) => ({ ...await original<typeof import("./preferences")>(), loadPreferencesFromSupabase: mocks.load }))
import { getPreferences } from "./server-preferences"
import { DEFAULT_PREFERENCES } from "./preferences"

beforeEach(() => { mocks.cookie = undefined; mocks.configured = false; mocks.user = null; mocks.load.mockReset() })
describe("server preference resolution", () => {
  it("uses validated guest settings on direct page visits", async () => {
    mocks.cookie = encodeURIComponent(JSON.stringify({ budget: 40, maxTravelMinutes: 7, optimizeFor: "fast" }))
    expect(await getPreferences()).toMatchObject({ budget: 40, maxTravelMinutes: 7, optimizeFor: "fast" })
  })
  it("loads signed-in settings ahead of guest cookies", async () => {
    mocks.configured = true; mocks.user = { id: "student" }
    mocks.cookie = encodeURIComponent(JSON.stringify({ budget: 40 }))
    mocks.load.mockResolvedValue({ ...DEFAULT_PREFERENCES, budget: 25 })
    expect((await getPreferences()).budget).toBe(25)
    expect(mocks.load).toHaveBeenCalledWith(expect.anything(), "student")
  })
  it("keeps guest settings when signed-in synchronization fails", async () => {
    mocks.configured = true; mocks.user = { id: "student" }
    mocks.cookie = encodeURIComponent(JSON.stringify({ budget: 40 }))
    mocks.load.mockRejectedValue(new Error("offline"))
    expect((await getPreferences()).budget).toBe(40)
  })
  it("validates overrides and ignores malformed cookies", async () => {
    mocks.cookie = "invalid"
    expect(await getPreferences({ budget: "NaN", maxTravelMinutes: "5", optimizeFor: "fast" })).toEqual({ ...DEFAULT_PREFERENCES, maxTravelMinutes: 5, optimizeFor: "fast" })
  })
})
