import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, isSupabaseConfigured, getUser } = vi.hoisted(() => ({
  createClient: vi.fn(), isSupabaseConfigured: vi.fn(), getUser: vi.fn(),
}))
vi.mock("./supabase/server", () => ({ createClient }))
vi.mock("./supabase/client", () => ({ isSupabaseConfigured }))
import { getConnectedCalendarAccessToken } from "./google-calendar"
beforeEach(() => {
  vi.resetAllMocks()
  isSupabaseConfigured.mockReturnValue(true)
  createClient.mockResolvedValue({ auth: { getUser } })
})
describe("optional Calendar connection", () => {
  it("keeps discovery usable when the account service is offline", async () => {
    getUser.mockRejectedValue(new Error("offline"))
    expect(await getConnectedCalendarAccessToken()).toBeNull()
  })
  it("does not create an account client when the integration is unconfigured", async () => {
    isSupabaseConfigured.mockReturnValue(false)
    expect(await getConnectedCalendarAccessToken()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })
  it("keeps discovery usable when the connection query fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    createClient.mockResolvedValue({ auth: { getUser }, from: () => { throw new Error("database offline") } })
    expect(await getConnectedCalendarAccessToken()).toBeNull()
  })
})
