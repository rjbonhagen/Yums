import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, getUser, signOut, verifyCalendarAccount, exchangeCodeForSession, fetchBusyIntervals, upsert, from, maybeSingle } = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), signOut: vi.fn(), verifyCalendarAccount: vi.fn(), exchangeCodeForSession: vi.fn(), fetchBusyIntervals: vi.fn(), upsert: vi.fn(), from: vi.fn(), maybeSingle: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient }))
vi.mock("@/lib/google-calendar", () => ({ fetchBusyIntervals, verifyCalendarAccount }))
import { GET } from "./route"
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("APP_ORIGIN", "")
  const chain = { select: () => chain, eq: () => chain, maybeSingle, upsert }
  from.mockReturnValue(chain)
  getUser.mockResolvedValue({ data: { user: { id: "verified-user", email: "person@berkeley.edu" } }, error: null })
  signOut.mockResolvedValue({ error: null })
  verifyCalendarAccount.mockResolvedValue(undefined)
  createClient.mockResolvedValue({ auth: { exchangeCodeForSession, getUser, signOut }, from })
  exchangeCodeForSession.mockResolvedValue({ data: { session: {
    provider_token: "test-provider-token", provider_refresh_token: null, user: { id: "verified-user", email: "person@berkeley.edu" },
  } }, error: null })
  maybeSingle.mockResolvedValue({ data: { refresh_token: "existing-refresh" }, error: null })
  upsert.mockResolvedValue({ error: null })
  fetchBusyIntervals.mockResolvedValue([])
})
describe("auth callback consent boundary", () => {
  it("redirects to localhost rather than the standalone listening address", async () => {
    const response = await GET(new Request("http://0.0.0.0:3000/auth/callback?code=test", { headers: { host: "localhost:3000" } }))
    expect(response.headers.get("location")).toBe("http://localhost:3000/start")
  })
  it("uses the configured hosted origin behind a proxy", async () => {
    vi.stubEnv("APP_ORIGIN", "https://pilot.example.test")
    const response = await GET(new Request("http://0.0.0.0:3000/auth/callback?code=test", { headers: { host: "attacker.example.test", "x-forwarded-host": "attacker.example.test" } }))
    expect(response.headers.get("location")).toBe("https://pilot.example.test/start")
  })
  it("rejects an unconfigured hosted callback before exchanging its code", async () => {
    const response = await GET(new Request("http://0.0.0.0:3000/auth/callback?code=test", { headers: { host: "attacker.example.test", "x-forwarded-host": "localhost:3000" } }))
    expect(response.status).toBe(503)
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
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
  it("rejects a Calendar callback without an initiating account", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
  it("rejects account switching during Calendar consent", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: "different-user", email: "other@gmail.com" }, provider_token: "test-token" } }, error: null })
    const response = await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))
    expect(response.headers.get("location")).toContain("calendar-account")
    expect(signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(upsert).not.toHaveBeenCalled()
  })
  it("rejects an already-linked Google identity with a different email", async () => {
    verifyCalendarAccount.mockRejectedValue(new Error("email mismatch"))
    await GET(new Request("http://localhost/auth/callback?code=test&calendar=connect"))
    expect(upsert).not.toHaveBeenCalled()
    expect(fetchBusyIntervals).not.toHaveBeenCalled()
  })
})
