import { beforeEach, describe, expect, it, vi } from "vitest"
const { createClient, getUser, rpc } = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), rpc: vi.fn() }))
vi.mock("./supabase/server", () => ({ createClient }))
import { reserveProviderReply } from "./chat-allowance"
beforeEach(() => {
  vi.resetAllMocks()
  createClient.mockResolvedValue({ auth: { getUser }, rpc })
  getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
})
describe("provider allowance", () => {
  it("rejects guests before invoking the allowance function", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await reserveProviderReply()).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
  it("requires explicit success from the database", async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    expect(await reserveProviderReply()).toBe(true)
    expect(rpc).toHaveBeenCalledWith("consume_chat_allowance")
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await reserveProviderReply()).toBe(false)
    rpc.mockResolvedValue({ data: true, error: new Error("missing migration") })
    expect(await reserveProviderReply()).toBe(false)
  })
  it("does not bypass limits when authentication is unavailable", async () => {
    createClient.mockRejectedValue(new Error("not configured"))
    expect(await reserveProviderReply()).toBe(false)
  })
})
