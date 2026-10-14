// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { CookieOptions } from "@supabase/ssr"
import { updateSession } from "./middleware"

const mocks = vi.hoisted(() => ({ configured: vi.fn(), create: vi.fn(), getUser: vi.fn() }))
vi.mock("./client", () => ({ isSupabaseConfigured: mocks.configured }))
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }))
type CookieChanges = { name: string; value: string; options?: CookieOptions }[]
type Options = { cookies: { getAll: () => { name: string; value: string }[]; setAll: (cookies: CookieChanges, headers: Record<string, string>) => void } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.configured.mockReturnValue(true)
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mocks.create.mockReturnValue({ auth: { getUser: mocks.getUser } })
})
function request() {
  return new NextRequest("http://localhost:3000/saved", { headers: { cookie: "session=old-token; preference=walking" } })
}

it("does not create an account client when Supabase is unconfigured", async () => {
  mocks.configured.mockReturnValue(false)
  await updateSession(request())
  expect(mocks.create).not.toHaveBeenCalled()
})

it("verifies the session and preserves request cookies when no refresh occurs", async () => {
  const incoming = request()
  const response = await updateSession(incoming)
  expect(mocks.getUser).toHaveBeenCalledTimes(1)
  expect(response.headers.get("x-middleware-request-cookie")).toContain("session=old-token")
  const options = mocks.create.mock.calls[0][2] as Options
  expect(options.cookies.getAll()).toEqual(incoming.cookies.getAll())
})

it("forwards rotated cookie chunks to the server and browser with cache protection", async () => {
  mocks.create.mockImplementation((_url: string, _key: string, options: Options) => ({ auth: { getUser: async () => {
    options.cookies.setAll([
      { name: "session", value: "new-token", options: { path: "/", sameSite: "lax" } },
      { name: "session.1", value: "new-chunk", options: { path: "/" } },
    ], { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" })
    return { data: { user: { id: "account-a" } }, error: null }
  } } }))
  const response = await updateSession(request())
  const forwarded = response.headers.get("x-middleware-request-cookie")
  expect(forwarded).toContain("session=new-token")
  expect(forwarded).toContain("session.1=new-chunk")
  expect(forwarded).toContain("preference=walking")
  expect(forwarded).not.toContain("old-token")
  expect(response.cookies.get("session")?.value).toBe("new-token")
  expect(response.cookies.get("session.1")?.value).toBe("new-chunk")
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  expect(response.headers.get("pragma")).toBe("no-cache")
  expect(response.headers.get("expires")).toBe("0")
})

it("forwards expired-session cookie removal without replaying the stale refresh token", async () => {
  mocks.create.mockImplementation((_url: string, _key: string, options: Options) => ({ auth: { getUser: async () => {
    options.cookies.setAll([{ name: "session", value: "", options: { path: "/", maxAge: 0 } }], { "Cache-Control": "private, no-store" })
    return { data: { user: null }, error: { code: "refresh_token_not_found" } }
  } } }))
  const response = await updateSession(request())
  expect(response.headers.get("x-middleware-request-cookie")).not.toContain("old-token")
  expect(response.cookies.get("session")?.maxAge).toBe(0)
})
