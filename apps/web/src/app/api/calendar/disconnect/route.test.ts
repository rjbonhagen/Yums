import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, getUser, eq, remove } = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), eq: vi.fn(), remove: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient }))
import { POST } from "./route"
beforeEach(() => {
  vi.resetAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
  eq.mockResolvedValue({ error: null })
  remove.mockReturnValue({ eq })
  createClient.mockResolvedValue({ auth: { getUser }, from: () => ({ delete: remove }) })
})
describe("Calendar disconnect", () => {
  it("deletes only the verified account connection", async () => {
    const response = await POST(new Request("http://localhost/api/calendar/disconnect", { method: "POST" }))
    expect(await response.json()).toEqual({ disconnected: true })
    expect(eq).toHaveBeenCalledWith("user_id", "verified-user")
  })
  it("rejects cross-origin requests before touching account data", async () => {
    expect((await POST(new Request("http://localhost/api/calendar/disconnect", { method: "POST", headers: { origin: "https://other.example" } }))).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
  })
  it("requires sign-in and preserves failure status when deletion fails", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect((await POST(new Request("http://localhost/api/calendar/disconnect", { method: "POST" }))).status).toBe(401)
    expect(remove).not.toHaveBeenCalled()
    eq.mockResolvedValueOnce({ error: new Error("database offline") })
    expect((await POST(new Request("http://localhost/api/calendar/disconnect", { method: "POST" }))).status).toBe(503)
  })
})
