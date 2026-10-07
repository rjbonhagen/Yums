import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, exchangeCodeForSession, fetchBusyIntervals, upsert, from, maybeSingle } = vi.hoisted(() => ({
  createClient: vi.fn(), exchangeCodeForSession: vi.fn(), fetchBusyIntervals: vi.fn(), upsert: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient }))
vi.mock("@/lib/google-calendar", () => ({ fetchBusyIntervals }))
import { GET } from "./route"
beforeEach(() => {
  vi.resetAllMocks()
  const chain = { select: () => chain, eq: () => chain, maybeSingle, upsert }
  from.mockReturnValue(chain)
  createClient.mockResolvedValue({ auth: { exchangeCodeForSession }, from })
  exchangeCodeForSession.mockResolvedValue({ data: { session: {
    provider_token: "test-provider-token", provider_refresh_token: null, user: { id: "verified-user" },
  } }, error: null })
  maybeSingle.mockResolvedValue({ data: { refresh_token: "existing-refresh" }, error: null })
  upsert.mockResolvedValue({ error: null })
  fetchBusyIntervals.mockResolvedValue([])
})
describe("auth callback consent boundary", () => {
  it("does not store Calendar tokens during ordinary Google sign-in", async () => {
    const response = await GET(new Request("http://localhost/auth/callback?code=test"))
    expect(response.headers.get("location")).toBe("http://localhost/start")
    expect(from).not.toHaveBeenCalled()
    expect(fetchBusyIntervals).not.toHaveBeenCalled()
  })
  it("checks actual Calendar access and preserves an existing refresh token on reconnect", async () => {
    await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))
    expect(fetchBusyIntervals).toHaveBeenCalledWith("test-provider-token", expect.any(Date), expect.any(Date))
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "verified-user", refresh_token: "existing-refresh" }))
  })
  it("does not store unusable tokens and reports failed persistence", async () => {
    fetchBusyIntervals.mockRejectedValueOnce(new Error("scope not granted"))
    const denied = await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))
    expect(denied.headers.get("location")).toContain("calendar-failed")
    expect(upsert).not.toHaveBeenCalled()
    upsert.mockResolvedValueOnce({ error: new Error("database offline") })
    expect((await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))).headers.get("location")).toContain("calendar-failed")
  })
  it("provides a retry path when the auth service throws", async () => {
    exchangeCodeForSession.mockRejectedValue(new Error("offline"))
    expect((await GET(new Request("http://localhost/auth/callback?code=test"))).headers.get("location")).toContain("auth-failed")
  })
})
